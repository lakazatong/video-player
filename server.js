"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const subtitle = require("subtitle");
const { exec, spawn } = require("child_process");

(async () => {
	/* args */

	let mediaDir = process.argv[2];
	// Linux
	let ankiMediaDir = `${process.env.HOME || "~"}/.local/share/Anki2/User 1/collection.media`;
	if (!fs.existsSync(ankiMediaDir)) {
		// WSL
		ankiMediaDir = path.join(
			process.env.APPDATA || (await getWindowsAppDataPath()),
			"Anki2/User 1/collection.media"
		);
	}

	if (!mediaDir) {
		console.error("Please provide full path of the videos/subtitles folder as an argument.");
		process.exit(1);
	}

	/* unix-ify paths */

	mediaDir = normalizePath(mediaDir);
	if (!fs.existsSync(mediaDir) || !fs.lstatSync(mediaDir).isDirectory()) {
		console.error(`Server: Invalid folder: ${mediaDir}`);
		process.exit(1);
	}

	ankiMediaDir = normalizePath(ankiMediaDir);
	if (!fs.existsSync(ankiMediaDir) || !fs.lstatSync(ankiMediaDir).isDirectory()) {
		console.error(`Server: Invalid folder: ${ankiMediaDir}`);
		process.exit(1);
	}

	/* init */

	const app = express();
	const port = process.env.SERVER_PORT;

	app.use(express.static(path.join(__dirname, "public")));
	app.use(express.json());

	/* endpoints */

	app.get("/video/:base", (req, res) => {
		console.log(`Server: /video/${req.params.base}`);
		const filePath = path.join(mediaDir, `${req.params.base}.mkv`);
		if (fs.existsSync(filePath)) res.sendFile(filePath);
		else res.status(404).send("Not found");
	});

	app.get("/subtitles/:base", (req, res) => {
		console.log(`Server: /subtitles/${req.params.base}`);
		const srtPath = path.join(mediaDir, `${req.params.base}.srt`);
		if (!fs.existsSync(srtPath)) return res.status(404).send("Not found");
		const srtContent = fs.readFileSync(srtPath, "utf-8");
		const cues = subtitle.parse(srtContent);
		res.json(cues);
	});

	app.get("/episodes", (req, res) => {
		console.log(`Server: /episodes`);
		const files = fs.readdirSync(mediaDir);
		const mkvs = files.filter((f) => f.endsWith(".mkv")).sort();
		const episodes = mkvs.map((f) => {
			const base = f.replace(/\.mkv$/, "");
			return base;
		});
		res.json(episodes);
	});

	app.post("/clip", (req, res) => {
		console.log(`Server: /clip`, req.body);
		const { base, startTime, endTime } = req.body;
		if (!base || !startTime || !endTime) {
			return res.status(400).json({ error: "base, startTime and endTime are required" });
		}

		const videoFile = path.join(mediaDir, `${base}.mkv`);

		if (!fs.existsSync(videoFile)) {
			return res.status(404).json({ error: `${videoFile} not found` });
		}

		const outputFile = path.join(ankiMediaDir, `${base}-${startTime}-${endTime}.mp4`);

		const ffmpegCommand = buildFFmpegCommand(videoFile, outputFile, startTime, endTime);
		console.log(ffmpegCommand);

		exec(ffmpegCommand, (error, stdout, stderr) => {
			if (error) {
				return res.status(500).json({ error: `FFmpeg error: ${stderr}` });
			}

			res.json({ message: "Video clipped successfully" });
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

	function buildFFmpegCommand(inputFile, outputFile, startTime, endTime) {
		return `ffmpeg -ss ${msToTime(startTime)} -to ${msToTime(
			endTime
		)} -i '${inputFile}' -vf "scale=-2:720" -c:v libx264 -crf 18 -preset veryslow -c:a copy '${outputFile}'`;
	}

	function normalizePath(raw) {
		let input = raw.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "").replace(/\\/g, "/");

		if (/^[A-Za-z]:\//.test(input)) {
			input = input.replace(/^[A-Za-z]:/, `/mnt/${input[0].toLowerCase()}`);
		}

		return input;
	}

	function getWindowsAppDataPath() {
		return new Promise((resolve, reject) => {
			const echo = spawn("cmd.exe", ["/c", "echo", "%APPDATA%"], {
				shell: true,
				stdio: ["ignore", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			echo.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			echo.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			echo.on("close", (code) => {
				if (code !== 0 || stderr.trim()) {
					reject(new Error(`Failed to get APPDATA: ${stderr}`));
					return;
				}

				const winPath = stdout.trim().replace(/\r/g, "");

				const wslpath = spawn("wslpath", ["-a", winPath], {
					stdio: ["ignore", "pipe", "pipe"],
				});

				let wslOut = "";
				let wslErr = "";

				wslpath.stdout.on("data", (data) => {
					wslOut += data.toString();
				});

				wslpath.stderr.on("data", (data) => {
					wslErr += data.toString();
				});

				wslpath.on("close", (code) => {
					if (code !== 0 || wslErr.trim()) {
						reject(new Error(`Failed to convert path: ${wslErr}`));
					} else {
						resolve(wslOut.trim());
					}
				});
			});
		});
	}
})();
