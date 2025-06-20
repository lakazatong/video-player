"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const subtitle = require("subtitle");
const { exec } = require("child_process");

// -----------------------------------------------------
//#region args

let mediaDir = process.argv[2];
let ankiMediaDir = process.env.ANKI_MEDIA_FOLDER;

if (!mediaDir) {
	console.error("Please provide full path of the videos/subtitles folder as an argument.");
	process.exit(1);
}

if (!fs.existsSync(mediaDir) || !fs.lstatSync(mediaDir).isDirectory()) {
	console.error(`Invalid folder: ${mediaDir}`);
	process.exit(1);
}

if (!fs.existsSync(ankiMediaDir) || !fs.lstatSync(ankiMediaDir).isDirectory()) {
	console.error(`Invalid folder: ${ankiMediaDir}`);
	process.exit(1);
}

// -----------------------------------------------------
//#region init

const app = express();
const port = process.env.SERVER_PORT;

app.use(express.static(__dirname));
app.use(express.json());

// -----------------------------------------------------
//#region endpoints

// app.get("/video/:base", (req, res) => {
// 	console.log(`\nServer: /video/${req.params.base}`);
// 	const filePath = path.join(mediaDir, `${req.params.base}.mkv`);
// 	if (fs.existsSync(filePath)) res.sendFile(filePath);
// 	else res.status(404).send("Not found");
// });

app.get("/video/:base", (req, res) => {
	console.log(`\nServer: /video/${req.params.base}`);
	const filePath = path.join(mediaDir, `${req.params.base}`);
	const mp4Path = filePath + ".mp4";

	if (!fs.existsSync(filePath + ".mkv")) {
		res.status(404).send("Not found");
		return;
	}

	if (fs.existsSync(mp4Path)) {
		res.sendFile(mp4Path);
	} else {
		const cmd = `ffmpeg -i "${filePath}.mkv" -c:v h264 -c:a aac -movflags +faststart -y "${mp4Path}"`;
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.error(`\nServer: Error converting video ${filePath} (${cmd}):`, stderr);
				res.status(500).send("Server error during conversion.");
			} else {
				console.log(`\nServer: Done converting video ${filePath}`);
				res.sendFile(mp4Path);
			}
		});
	}
});

app.get("/subtitles/:base", (req, res) => {
	console.log(`\nServer: /subtitles/${req.params.base}`);
	const srtPath = path.join(mediaDir, `${req.params.base}.srt`);
	if (!fs.existsSync(srtPath)) return res.status(404).send("Not found");
	const srtContent = fs.readFileSync(srtPath, "utf-8");
	const cues = subtitle.parse(srtContent);
	res.json(cues);
});

app.get("/episodes", (req, res) => {
	console.log(`\nServer: /episodes`);
	const files = fs.readdirSync(mediaDir);
	const mkvs = files.filter((f) => f.endsWith(".mkv")).sort();
	const episodes = mkvs.map((f) => {
		const base = f.replace(/\.mkv$/, "");
		return base;
	});
	res.json(episodes);
});

const formatsEncoders = {
	webm: [
		["libvpx-vp9", "libopus"],
		["libsvtav1", "libopus"],
		["libvpx", "libvorbis"],
		["libvpx-vp9", "libvorbis"],
		["libsvtav1", "libvorbis"],
		["libvpx", "libopus"],
	],
	mp4: [
		["libx264", "aac"],
		["libx265", "aac"],
		["libx264", "libopus"],
		["libx264", "ac3"],
		["libx265", "libopus"],
		["libx265", "ac3"],
		["libsvtav1", "libopus"],
		["libxvid", "aac"],
		["libx264", "mp3"],
		["libx264", "alac"],
	],
	"3gp": [
		["libxvid", "aac"],
		["libx264", "aac"],
	],
	mkv: [
		["libsvtav1", "libopus"],
		["libvpx-vp9", "libopus"],
		["libx265", "libopus"],
		["libx264", "libopus"],
		["libx265", "aac"],
		["libx264", "aac"],
		["libsvtav1", "flac"],
		["libvpx-vp9", "libvorbis"],
		["libx264", "ac3"],
		["libx265", "flac"],
	],
};

app.post("/clip", (req, res) => {
	console.log(`\nServer: /clip`, req.body);
	const { base, startTime, endTime, ext } = req.body;

	if (!base || !startTime || !endTime || !ext) {
		return res.status(400).json({ error: "base, startTime, endTime and ext are required" });
	}

	const encoders = formatsEncoders[ext];
	if (!encoders || encoders.length === 0) {
		return res.status(400).json({ error: `Unsupported extension: ${ext}` });
	}

	const videoFile = path.join(mediaDir, `${base}.mkv`);
	if (!fs.existsSync(videoFile)) {
		return res.status(404).json({ error: `${videoFile} not found` });
	}

	let completed = 0;
	let failed = false;

	for (const [ve, ae] of encoders) {
		const outputFile = path.join(ankiMediaDir, `${cleanPath(base)}-${startTime}-${endTime}-${ve}-${ae}.${ext}`);
		const cmd = buildFFmpegCommand(videoFile, outputFile, startTime, endTime, ve, ae);
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.error(`\nServer: Error clipping video for ${base} (${cmd}):`, stderr);
				failed = true;
			} else {
				console.log(
					`\nServer: Clipped video for ${base} in ${ext} from ${startTime} to ${endTime} using ${ve} ${ae}`
				);
			}

			completed++;
			if (completed === encoders.length) {
				if (failed) {
					res.status(500).json({ error: "One or more encodings failed" });
				} else {
					res.json({ message: "Video clipped successfully" });
				}
			}
		});
	}
});

// -----------------------------------------------------
//#region main

app.listen(port, () => {
	console.log(`Server: running at http://localhost:${port}`);
});

require("./proxy");

// -----------------------------------------------------
//#region utils

function msToTime(ms) {
	let h = Math.floor(ms / 3600000);
	let m = Math.floor((ms % 3600000) / 60000);
	let s = Math.floor((ms % 60000) / 1000);
	let msRemain = ms % 1000;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(
		msRemain
	).padStart(3, "0")}`;
}

function buildFFmpegCommand(inputFile, outputFile, startTime, endTime, ve, ae) {
	return `ffmpeg -i "${inputFile}" -ss ${msToTime(startTime)} -t ${msToTime(
		endTime - startTime
	)} -vf "scale=1280:-2" -c:v ${ve} -c:a ${ae} -movflags +faststart  -y "${outputFile}"`;
}

function cleanPath(path) {
	return path
		.trim()
		.replace(/ /g, "_")
		.replace(/[^a-zA-Z0-9_-]/g, "")
		.replace(/__+/g, "_");
}
