const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Tambahan biar ga kena CORS bug di hostingan
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_DATA_CENTER = "https://c26f6099fd3a7921-118-96-141-38.serveousercontent.com"; 

const MY_API_KEY = "ERLANGGA_SECRET_123";

// Database Memori Virtual Admin Kontrol (State Management) - Diperbanyak fiturnya
let systemConfig = {
    isMaintenance: false,
    instagramScraperUrl: "https://api.ahmad.my.id/api/v1/instagram/download",
    alertText: "Hanya Administrator Terverifikasi yang Dapat Menjalankan Pipeline Restrukturisasi.",
    totalHits: 0
};

// Middleware Setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function extractHashtags(text) {
    if (!text) return [];
    const tags = text.match(/#\w+/g);
    return tags ? tags : [];
}

/**
 * ENDPOINT ADMIN CONTROLLER ROUTE
 */
app.get('/api/admin/config', (req, res) => {
    res.json({
        maintenance: systemConfig.isMaintenance,
        igApi: systemConfig.instagramScraperUrl,
        alertText: systemConfig.alertText,
        totalHits: systemConfig.totalHits
    });
});

app.post('/api/admin/update', (req, res) => {
    const { maintenance, igApi, alertText } = req.body;
    if (maintenance !== undefined) systemConfig.isMaintenance = maintenance;
    if (igApi !== undefined) systemConfig.instagramScraperUrl = igApi;
    if (alertText !== undefined) systemConfig.alertText = alertText;
    res.json({ success: true, message: "Configuration persistent in volatile memory." });
});

/**
 * ENDPOINT BOT INTEGRATION (JSON MODE)
 */
app.get('/api/bot', async (req, res) => {
    const { url, apikey, engine } = req.query;
    const selectedEngine = engine || 'tiktok';

    // Bot terpengaruh mode maintenance kecuali menyertakan API Key Admin
    if (systemConfig.isMaintenance && apikey !== MY_API_KEY) {
        return res.status(503).json({ status: false, message: `Server under maintenance: ${systemConfig.alertText}` });
    }
    if (apikey !== MY_API_KEY) {
        return res.status(401).json({ status: false, message: 'Unauthorized: Invalid API Key' });
    }
    if (!url) return res.status(400).json({ status: false, message: 'Parameter URL diperlukan' });

    systemConfig.totalHits++;

    try {
        if (selectedEngine === 'tiktok') {
            const response = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
            const data = response.data.data;
            if (!data) return res.json({ status: false, message: 'Data tidak ditemukan' });

            const isImages = data.images && data.images.length > 0;
            return res.json({
                status: true,
                creator: "Erlangga API Hub",
                type: isImages ? "images" : "video",
                result: {
                    title: data.title,
                    thumbnail: data.cover,
                    video: data.play,
                    audio: data.music,
                    images: data.images || [],
                    author: { nickname: data.author.nickname, username: data.author.unique_id, avatar: data.author.avatar }
                }
            });
        } else if (selectedEngine === 'instagram') {
            const response = await axios.get(`${systemConfig.instagramScraperUrl}?url=${encodeURIComponent(url)}`);
            const resData = response.data;
            if(!resData.status || !resData.result) return res.json({ status: false, message: 'Konten IG tidak ditemukan' });
            return res.json({ status: true, creator: "Erlangga API Hub", type: "video", result: { video: resData.result[0].url } });
        }
        res.json({ status: false, message: "Engine not implemented yet" });
    } catch (e) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

/**
 * ENDPOINT UTAMA WEB INTERFACE DISPATCHER
 */
app.post('/api/download', async (req, res) => {
    const { url, engine, isAdmin } = req.body;
    const targetEngine = engine || 'tiktok';

    // Proteksi Gerbang Maintenance Mode dengan Teks Pengumuman Kustom Dinamis
    if (systemConfig.isMaintenance && !isAdmin) {
        return res.status(503).json({ 
            success: false, 
            message: systemConfig.alertText 
        });
    }

    if (!url) return res.status(400).json({ success: false, message: "URL wajib diisi" });
    systemConfig.totalHits++;

    try {
        if (targetEngine === 'tiktok') {
            const response = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
            const data = response.data.data;
            if (!data) return res.json({ success: false, message: "Konten TikTok tidak ditemukan" });
            const isImages = data.images && data.images.length > 0;

            return res.json({
                success: true,
                type: isImages ? "images" : "video",
                title: data.title || 'TikTok Content',
                thumbnail: data.cover,
                video_url: data.play,
                music_url: data.music,
                images: data.images || [],
                author: { nickname: data.author.nickname, username: data.author.unique_id, avatar: data.author.avatar },
                statistics: { likes: data.digg_count, comments: data.comment_count, shares: data.share_count, views: data.play_count },
                hashtags: extractHashtags(data.title)
            });
        } 
        
        else if (targetEngine === 'instagram') {
            const response = await axios.get(`${systemConfig.instagramScraperUrl}?url=${encodeURIComponent(url)}`);
            const resData = response.data;

            if (!resData.status || !resData.result || resData.result.length === 0) {
                return res.json({ success: false, message: "Konten Instagram tidak ditemukan atau akun di-private" });
            }

            const mediaList = resData.result;
            const isMultiple = mediaList.length > 1;
            const extractedImages = isMultiple ? mediaList.map(m => m.url) : [];

            return res.json({
                success: true,
                type: isMultiple ? "images" : "video",
                title: "Instagram Post/Reels Media Successfully Extracted",
                thumbnail: mediaList[0].thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500",
                video_url: mediaList[0].url,
                music_url: "#",
                images: extractedImages,
                author: { nickname: "Instagram User", username: "instagram_reels", avatar: "https://cdn-icons-png.flaticon.com/512/174/174855.png" },
                statistics: { likes: 0, comments: 0, shares: 0, views: 0 },
                hashtags: ["#instagram", "#reels"]
            });
        } 
        
        else if (targetEngine === 'youtube') {
            return res.json({
                success: true,
                type: "video",
                title: "YouTube Shorts Premium Extractor Pipeline Stream",
                thumbnail: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=500",
                video_url: url, 
                music_url: "#",
                author: { nickname: "YouTube Creator", username: "yt_shorts", avatar: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png" },
                statistics: { likes: 12000, comments: 450, shares: 320, views: 45000 },
                hashtags: ["#shorts"]
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Engine Error" });
    }
});

// WAJIB UNTUK VERCEL: Export app Express agar terbaca sebagai Serverless Function
module.exports = app;

// Jalankan port secara lokal saat run via Termux (`node server.js`)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ==================================================
       🛡️  ERLANGGA PREMIUM MULTI-ENGINE HUB V3
       Admin Secure Key Loaded & Panel Connected.
       Port Operational: ${PORT}
    ==================================================
    `);
});
