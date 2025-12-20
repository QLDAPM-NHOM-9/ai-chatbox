import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { fetchTourById } from "./src/services/bookingBackendClient.js";

console.log(">>> server.js loaded");

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" })); // FE Vite
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("AI Service is running. Try GET /health");
});

// Chỉ tạo client OpenAI khi cần (tránh crash nếu chưa set key mà đang mock)
const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "ai-service", time: new Date().toISOString() });
});

/**
 * Option A (non-stream): Generate itinerary suggestion
 * POST /api/itinerary
 * body: { tourId, days, preferences, budgetLevel, pace, constraints }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, tourId = null, context = null } = req.body || {};
    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }
    console.log(`[/api/chat] message="${message}" | tourId=${tourId} | hasContext=${!!context}`);

    const mockMode = (process.env.AI_MOCK_MODE || "false").toLowerCase() === "true";
    if (mockMode) {
      return res.json({
        source: "mock",
        reply: `Mock trả lời: "${message}"` + 
               (tourId ? ` (Tour: ${tourId})` : "") + 
               (context ? " (Kèm ngữ cảnh bên lề)" : ""), 
      });
    }
    if (!openai) {
      return res.status(500).json({ error: "OpenAI client not initialized" });
    }

    let finalTourContext = "";

    if (context) {
      // Nếu Frontend đã gửi sẵn thông tin tour/ngữ cảnh, dùng luôn
      finalTourContext = typeof context === "string" ? context : JSON.stringify(context, null, 2);
    } else if (tourId) {
      // Nếu chỉ có ID, AI mới chủ động đi hỏi Backend chính (port 8080)
      try {
        const tourData = await fetchTourById(tourId);
        finalTourContext = JSON.stringify(tourData, null, 2);
      } catch (e) {
        console.warn("Could not fetch tour data from BE, proceeding without context.");
      }
    }

    let systemPrompt = `
Bạn là trợ lý AI chuyên nghiệp của Elysian Realm – nền tảng đặt tour du lịch.
Nhiệm vụ của bạn:
- Tư vấn lịch trình và gợi ý các tour phù hợp dựa trên nhu cầu khách hàng.
- Trả lời bằng Tiếng Việt với phong cách thân thiện, ngắn gọn và dễ hiểu.
- Nếu có thông tin TOUR_CONTEXT bên dưới, hãy ưu tiên bám sát dữ liệu đó để tư vấn chính xác về giá, địa điểm và lịch trình.
- Khi so sánh, ưu tiên trình bày dạng bảng hoặc gạch đầu dòng rõ ràng.
- Luôn có phần kết luận hoặc gợi ý cho người dùng.
QUY TẮC TRẢ LỜI:
- Xóa các định dạng ký tự đặt biệt (như dấu ###, **, _) trong câu trả lời.
- Chia đoạn rõ ràng, mỗi ý một dòng.
- Dùng dấu gạch đầu dòng (-) khi liệt kê.
- Dùng tiêu đề ngắn nếu nội dung dài.
- Giữa các đoạn phải có dòng trống.
- Không viết một đoạn văn quá dài.
TRƯỜNG HỢP ĐẶC BIỆT:
- Nếu người dùng hỏi về hoàn tiền, khiếu nại, sự cố, tư vấn nhân viên:
  + Không tự suy đoán chính sách.
  + Luôn hướng dẫn liên hệ bộ phận hỗ trợ chính thức.
  + Trả về thông tin sau:

  Email: support@elysianrealm.vn
  Hotline: 1900 1234
  Thời gian làm việc: 8:00 – 18:00 (Thứ 2 – Thứ 6)

`.trim();

    if (finalTourContext) {
      systemPrompt += `\n\nThông tin tour hiện tại khách đang xem (TOUR_CONTEXT):\n${finalTourContext}`;
    }

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7, // Độ sáng tạo vừa phải cho tư vấn du lịch
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content.trim();
    
    // Trả về kết quả cho Frontend
    return res.json({ source: "openai", reply });

  } catch (err) {
    console.error("CHAT error:", err);
    return res.status(500).json({ error: "Chat failed", detail: err.message });
  }
});

// KHỞI CHẠY SERVER Ở PORT 3001
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(">>> app.listen called");
  console.log(`[ai-service] running on http://localhost:${PORT}`);
});