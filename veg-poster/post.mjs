import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --- Minimal .env loader (no external deps) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadDotenv(envPath = path.join(__dirname, ".env")) {
  try {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch (e) {
    console.warn(".env load failed:", e.message);
  }
}

loadDotenv();

// --- Config ---
const IG_BUSINESS_ID = process.env.IG_BUSINESS_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || "自家菜園";

if (Number.parseInt(process.versions.node.split(".")[0], 10) < 18) {
  console.error("Node 18+ is required (global fetch). Update Node.");
  process.exit(1);
}

if (!IG_BUSINESS_ID || !IG_ACCESS_TOKEN) {
  console.error("Missing IG creds in .env (IG_BUSINESS_ID / IG_ACCESS_TOKEN)");
  process.exit(1);
}

// --- Helpers ---
function guessMetaFromFilename(filename) {
  // 例: tomato_harvest_奈良.jpg / komatsuna_germination.jpg
  const base = path.basename(filename).toLowerCase();
  const cropMap = {
    tomato: "トマト",
    komatsuna: "小松菜",
    spinach: "ほうれん草",
    cucumber: "きゅうり",
    eggplant: "なす",
    pepper: "ピーマン",
    potato: "じゃがいも",
    carrot: "にんじん",
  };
  let crop = "野菜";
  for (const [k, v] of Object.entries(cropMap)) {
    if (base.includes(k)) {
      crop = v;
      break;
    }
  }

  let stage = "harvest";
  if (base.includes("plant") || base.includes("植") || base.includes("定植")) stage = "planting";
  if (base.includes("germin") || base.includes("sprout") || base.includes("発芽") || base.includes("種")) stage = "germination";

  const locMatch = base.match(/_(奈良|大阪|京都|tokyo|nara|kyoto|osaka)/i);
  const location = locMatch
    ? locMatch[1]
        .replace(/tokyo/i, "東京")
        .replace(/nara/i, "奈良")
        .replace(/kyoto/i, "京都")
        .replace(/osaka/i, "大阪")
    : DEFAULT_LOCATION;

  const month = new Date().getMonth() + 1;
  const season = month <= 2 ? "冬" : month <= 5 ? "春" : month <= 8 ? "夏" : month <= 11 ? "秋" : "冬";

  return { crop, stage, location, season };
}

function simpleCaption({ crop, stage, season, location }) {
  // 最低限のフォールバック文（LLM失敗時でも投稿できる）
  const stageLine =
    stage === "planting"
      ? "今日の一手が実りに変わる。"
      : stage === "germination"
      ? "双葉が合図、ここから物語が始まる。"
      : "完熟の合図、今が食べどき。";
  const body = `${location}の畑より。${season}の${crop}、${stageLine}`;
  const tagsCommon = ["#家庭菜園", "#菜園記録", "#homegrown", "#gardening", "#kitchengarden"];
  const tagsStage =
    stage === "planting"
      ? ["#植え付け", "#定植", "#soilprep"]
      : stage === "germination"
      ? ["#発芽", "#seedling", "#sprouting"]
      : ["#収穫", "#収穫日記", "#freshharvest"];
  const cropTag = `#${crop}`;
  return `${body}\n${[...tagsCommon, ...tagsStage, cropTag].slice(0, 10).join(" ")}`;
}

async function createMediaContainer(imagePath, caption) {
  // Instagram Graph APIは公開URLの画像のみ受け付けます（ローカルファイル不可）。
  if (!/^https?:\/\//i.test(imagePath)) {
    throw new Error("imagePathは公開URLを指定してください（S3等）。");
  }
  const url = new URL(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ID}/media`);
  url.searchParams.set("image_url", imagePath);
  url.searchParams.set("caption", caption);
  url.searchParams.set("access_token", IG_ACCESS_TOKEN);

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Create media failed:", data);
    throw new Error("media作成に失敗");
  }
  return data.id;
}

async function publishMedia(creationId) {
  const url = new URL(`https://graph.facebook.com/v21.0/${IG_BUSINESS_ID}/media_publish`);
  url.searchParams.set("creation_id", creationId);
  url.searchParams.set("access_token", IG_ACCESS_TOKEN);

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Publish failed:", data);
    throw new Error("公開に失敗");
  }
  return data;
}

// === 実行 ===
// 使い方: node post.mjs "https://your-cdn.example.com/tomato_harvest_nara.jpg"
const imageUrl = process.argv[2];
if (!imageUrl) {
  console.error("Usage: node post.mjs <imagePublicURL>");
  process.exit(1);
}

const meta = guessMetaFromFilename(imageUrl);
const caption = simpleCaption(meta); // 実運用はLLMで上書き生成
console.log("Caption Preview:\n", caption, "\n");

const creationId = await createMediaContainer(imageUrl, caption);
const published = await publishMedia(creationId);
console.log("Published:", published);

