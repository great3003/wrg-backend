import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === ROOT CHECK ===
app.get("/", (req, res) => {
  res.send("🧠 WRG backend is live!");
});

// === NEYNAR USER VERIFY ===
app.get("/api/verifyUser/:fid", async (req, res) => {
  try {
    const fid = req.params.fid;
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      { headers: { "X-Api-Key": process.env.NEYNAR_API_KEY } }
    );
    const data = await response.json();
    const user = data.users?.[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfp: user.pfp_url,
      wallet: user.verifications?.[0] || null,
    });
  } catch (err) {
    console.error("verifyUser error:", err);
    res.status(500).json({ error: "Failed to verify user" });
  }
});

// === SUPABASE SAVE SCORE ===
app.post("/api/saveScore", async (req, res) => {
  try {
    const { fid, username, score } = req.body;

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/players`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        fid,
        username,
        total_score: score,
      }),
    });

    if (!response.ok) throw new Error("Supabase insert failed");
    res.json({ success: true });
  } catch (err) {
    console.error("saveScore error:", err);
    res.status(500).json({ error: "Failed to save score" });
  }
});

// === LEADERBOARD ===
app.get("/api/leaderboard", async (req, res) => {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/players?select=fid,username,total_score&order=total_score.desc&limit=100`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// === ZORA MINT BADGE ===
app.post("/api/mintBadge", async (req, res) => {
  const { badge, score, fid, wallet } = req.body;

  if (!wallet)
    return res.status(400).json({ error: "No wallet linked to this user" });

  try {
    const metadata = {
      name: badge,
      description: `Awarded for scoring ${score} points in WRG.`,
      image: `https://yourcdn.com/badges/${badge
        .replace(/\s+/g, "_")
        .toLowerCase()}.png`,
      attributes: [{ trait_type: "Score", value: score }],
    };

    const mintData = {
      chain: "zora-mainnet",
      metadata,
      mint_to_address: wallet,
    };

    const response = await fetch("https://api.zora.co/v1/mints", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ZORA_API_KEY}`,
      },
      body: JSON.stringify(mintData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Zora mint error:", data);
      return res.status(500).json({ error: "Mint failed" });
    }

    res.json({
      success: true,
      mintUrl: `https://zora.co/collect/${data.contract_address}:${data.token_id}`,
    });
  } catch (err) {
    console.error("mintBadge error:", err);
    res.status(500).json({ error: "Failed to mint badge" });
  }
});

// === RUN SERVER ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ WRG backend running on port ${PORT}`));
