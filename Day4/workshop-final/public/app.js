import { renderMarkdown } from "./markdown.js";

const chat = document.querySelector("#chat");
const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");
const suggestions = document.querySelector("#suggestions");
const status = document.querySelector("#status");
const connectionDetail = document.querySelector("#connectionDetail");
const pipeline = document.querySelector("#pipeline");
const pipelineSteps = [...pipeline.querySelectorAll("li")];
const pipelineOrder = pipelineSteps.map((step) => step.dataset.step);

let busy = false;
let history = [];
let appMode = "live";
let pipelineResetTimer;

function setPipelineState(activeStep) {
  clearTimeout(pipelineResetTimer);
  const activeIndex = pipelineOrder.indexOf(activeStep);
  pipeline.dataset.running = "true";

  pipelineSteps.forEach((step, index) => {
    step.dataset.state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
    if (index === activeIndex) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
}

function finishPipeline() {
  pipelineSteps.forEach((step) => {
    step.dataset.state = "complete";
    step.removeAttribute("aria-current");
  });
  pipeline.dataset.running = "false";
  pipelineResetTimer = setTimeout(resetPipeline, 2_000);
}

function failPipeline() {
  const active = pipeline.querySelector('[data-state="active"]');
  if (active) active.dataset.state = "error";
  pipeline.dataset.running = "false";
  pipelineResetTimer = setTimeout(resetPipeline, 3_000);
}

function resetPipeline() {
  clearTimeout(pipelineResetTimer);
  pipeline.removeAttribute("data-running");
  pipelineSteps.forEach((step) => {
    step.removeAttribute("data-state");
    step.removeAttribute("aria-current");
  });
}

function scrollToLatest() {
  chat.scrollTop = chat.scrollHeight;
}

function addMessage(role, text, options = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}${options.error ? " error" : ""}`;

  const icon = document.createElement("div");
  icon.className = "message-icon";
  icon.textContent = role === "user" ? "คุณ" : options.error ? "!" : "AI";

  const bubble = document.createElement("div");
  const useMarkdown = role === "bot" && !options.error;
  bubble.className = `bubble${useMarkdown ? " markdown" : ""}`;
  if (useMarkdown) {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  if (options.toolCallCount) {
    const note = document.createElement("div");
    note.className = "tool-note";
    note.textContent =
      options.mode === "demo" || appMode === "demo"
        ? `จำลองการเรียก Snowflake ${options.toolCallCount} ครั้ง`
        : `ตรวจข้อมูลจาก Snowflake ${options.toolCallCount} ครั้ง`;
    bubble.append(note);
  }

  wrapper.append(icon, bubble);
  chat.append(wrapper);
  scrollToLatest();
  return wrapper;
}

function addTyping() {
  const wrapper = addMessage("bot", "");
  wrapper.id = "typing";
  wrapper.querySelector(".bubble").innerHTML =
    '<div class="typing"><span></span><span></span><span></span></div>';
}

function removeTyping() {
  document.querySelector("#typing")?.remove();
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  input.style.overflowY = input.scrollHeight > 150 ? "auto" : "hidden";
}

function greet() {
  addMessage(
    "bot",
    "เชื่อมต่อข้อมูลยอดขายแล้วครับ\n\nลองถามเรื่อง **รายได้**, **AOV**, เมนู หรือช่องทางการสั่งซื้อได้เลย",
  );
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    appMode = result.mode || "live";
    const statusText = appMode === "demo" ? "โหมดตัวอย่าง ใช้ข้อมูลจำลอง" : "เชื่อมต่อ Snowflake ผ่าน SQL API";
    status.textContent = statusText;
    status.dataset.state = "ok";
    connectionDetail.textContent =
      appMode === "demo"
        ? "Prototype พร้อมทดลอง ไม่ได้ query บัญชีจริง"
        : `เชื่อมต่อแล้ว โหลด schema ${result.schemaColumns} คอลัมน์ไว้ใน cache`;
    connectionDetail.dataset.state = "ok";
  } catch (error) {
    status.textContent = error.message || "ยังเชื่อมต่อ backend ไม่สำเร็จ";
    status.dataset.state = "error";
    connectionDetail.textContent = "เชื่อมต่อไม่สำเร็จ ตรวจ backend, Snowflake account URL และ PAT";
    connectionDetail.dataset.state = "error";
  }
}

async function ask(rawMessage) {
  const message = rawMessage.trim();
  if (!message || busy) return;

  const priorHistory = history.slice();
  history.push({ role: "user", text: message });
  addMessage("user", message);
  input.value = "";
  resizeInput();
  suggestions.hidden = true;
  busy = true;
  sendButton.disabled = true;
  setPipelineState("frontend");
  addTyping();

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: priorHistory }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "ระบบตอบคำถามไม่สำเร็จ");
    }
    if (!response.body) throw new Error("Browser ไม่รองรับ streaming response");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result;

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress") setPipelineState(event.step);
        if (event.type === "answer") result = event;
        if (event.type === "error") throw new Error(event.error);
      }

      if (done) break;
    }
    if (!result) throw new Error("ระบบจบการทำงานโดยไม่ได้ส่งคำตอบ");

    removeTyping();
    addMessage("bot", result.answer, { toolCallCount: result.toolCallCount, mode: result.mode });
    history.push({ role: "model", text: result.answer });
    finishPipeline();
  } catch (error) {
    removeTyping();
    addMessage("bot", error.message || "เชื่อมต่อไม่สำเร็จ", { error: true });
    history.pop();
    failPipeline();
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.focus();
  }
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(input.value);
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    ask(input.value);
  }
});

suggestions.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => ask(button.textContent));
});

clearButton.addEventListener("click", () => {
  history = [];
  chat.replaceChildren();
  suggestions.hidden = false;
  resetPipeline();
  greet();
  input.focus();
});

greet();
checkHealth();
input.focus();
