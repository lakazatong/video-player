"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const subtitle = require("subtitle");
const { exec } = require("child_process");

(async () => {
	/* args */

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

	/* init */

	const app = express();
	const port = process.env.SERVER_PORT;

	app.use(express.static(path.join(__dirname, "public")));
	app.use(express.json());

	/* endpoints */

	app.get("/video/:base", (req, res) => {
		console.log(`\nServer: /video/${req.params.base}`);
		const filePath = path.join(mediaDir, `${req.params.base}.mkv`);
		if (fs.existsSync(filePath)) res.sendFile(filePath);
		else res.status(404).send("Not found");
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

	app.post("/clip", (req, res) => {
		console.log(`\nServer: /clip`, req.body);
		const { base, startTime, endTime } = req.body;
		if (!base || !startTime || !endTime) {
			return res.status(400).json({ error: "base, startTime and endTime are required" });
		}

		const videoFile = path.join(mediaDir, `${base}.mkv`);

		if (!fs.existsSync(videoFile)) {
			return res.status(404).json({ error: `${videoFile} not found` });
		}

		Promise.all([
			new Promise((resolve, reject) => {
				exec(
					buildFFmpegCommand(
						videoFile,
						path.join(ankiMediaDir, `${base}-${startTime}-${endTime}.webm`),
						startTime,
						endTime,
						`-vf "scale=-2:720" -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 96k -movflags +faststart -y`
					),
					(error, stdout, stderr) => {
						if (error) reject(`FFmpeg error: ${stderr}`);
						else resolve();
					}
				);
			}),
			new Promise((resolve, reject) => {
				exec(
					buildFFmpegCommand(
						videoFile,
						path.join(ankiMediaDir, `${base}-${startTime}-${endTime}.mp4`),
						startTime,
						endTime,
						`-vf "scale=-2:720" -c:v libx264 -crf 30 -preset fast -c:a aac -b:a 192k -movflags +faststart -y`
					),
					(error, stdout, stderr) => {
						if (error) reject(`FFmpeg error: ${stderr}`);
						else resolve();
					}
				);
			}),
		])
			.then(() => {
				console.log(`\nServer: Clipped video for ${base} from ${startTime} to ${endTime}`);
				res.json({ message: "Video clipped successfully" });
			})
			.catch((error) => {
				console.error(`\nServer: Error clipping video for ${base}:`, error);
				res.status(500).json({ error: "Error clipping video" });
			});
	});

	/* main */

	app.listen(port, () => {
		console.log(`Server: running at http://localhost:${port}`);
	});

	require("./proxy");

	/* utils */

	// function getSubtitleForTimestamp(timestamp, cues) {
	// 	const timestampInMs = timestamp * 1000
	// 	return cues.find(cue => cue.start <= timestampInMs && cue.end >= timestampInMs)
	// }

	function msToTime(ms) {
		let h = Math.floor(ms / 3600000);
		let m = Math.floor((ms % 3600000) / 60000);
		let s = Math.floor((ms % 60000) / 1000);
		let msRemain = ms % 1000;
		return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(
			msRemain
		).padStart(3, "0")}`;
	}

	function buildFFmpegCommand(inputFile, outputFile, startTime, endTime, options) {
		return `ffmpeg -i "${inputFile}" -ss ${msToTime(startTime)} -t ${msToTime(
			endTime - startTime
		)} ${options} "${outputFile}"`;
	}
})();
