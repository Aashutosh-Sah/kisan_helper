import Groq from "groq-sdk";

async function test() {
  const groq = new Groq({ apiKey: "gsk_test" }); // invalid key is fine for testing 404 vs 401
  try {
    await groq.chat.completions.create({
      messages: [{ role: "user", content: "hello" }],
      model: "llama-3.2-11b-vision-preview"
    });
  } catch(e) {
    console.log(e.message);
  }
}
test();
