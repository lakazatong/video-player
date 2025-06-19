"use strict";

require("dotenv").config();

const http = require("http");
const axios = require("axios");
const he = require("he");
const fs = require("fs");
const path = require("path");

// -----------------------------------------------------
//#region globals

const serverPort = process.env.SERVER_PORT;
const ankiPort = process.env.ANKI_PORT;
const proxyPort = process.env.PROXY_PORT;

// -----------------------------------------------------
//#region proxy

const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
	});

	req.on("end", async () => {
		const headers = { ...req.headers };

		const data = body ? JSON.parse(body) : undefined;

		async function followUp() {
			const axiosConfig = {
				method: req.method,
				url: `http://localhost:${ankiPort}${req.url}`,
				headers,
				data,
				responseType: "stream",
			};

			const response = await axios(axiosConfig);

			res.writeHead(response.status, response.headers);

			response.data.pipe(res);

			response.data.on("error", (err) => {
				console.error("\nProxy: Error while streaming response:", err);
				res.statusCode = 500;
				res.end("Internal Server Error");
			});

			res.on("error", (err) => {
				console.error("\nProxy: Error during response to client:", err);
			});
		}

		try {
			if (
				req.method !== "POST" ||
				req.url !== "/" ||
				(data?.action !== "addNote" && data?.action !== "updateNoteFields")
			) {
				followUp();
				return;
			}

			const urlHtml = data?.params?.note?.fields?.Url;
			const { base, time } = parseUrl(urlHtml);

			if (!base) {
				followUp();
				return;
			}

			const cues = (await (await fetch(`http://localhost:${serverPort}/subtitles/${base}`)).json()).map(
				(cue) => ({
					...cue,
					text: cue.text.replace(/\r?\n/g, "\n"),
				})
			);

			const cueIndex = cues.findIndex((c) => time >= c.start && time <= c.end);

			if (cueIndex === -1) {
				followUp();
				return;
			}

			const cue = cues[cueIndex];
			console.log("\nProxy: Request from video-player client:", body);

			const prevCue = cues[cueIndex - 1];
			const nextCue = cues[cueIndex + 1];

			const startTime = Math.max(cue.start - 2500, prevCue ? prevCue.start : cue.start);
			const endTime = Math.min(cue.end + 2500, nextCue ? nextCue.end : cue.end);

			data.params.note.fields.Url = `${base}-${startTime}-${endTime}`;
			data.params.note.fields.Subtitles = JSON.stringify({
				prev: prevCue?.text || "",
				cur: cue?.text || "",
				next: nextCue?.text || "",
			});

			headers["content-length"] = Buffer.byteLength(JSON.stringify(data)).toString();

			const baseClipPath = path.join(process.env.ANKI_MEDIA_FOLDER, data.params.note.fields.Url);

			for (const ext of ["webm", "3gp"]) {
				if (!fs.existsSync(`${baseClipPath}.${ext}`)) {
					axios
						.post(`http://localhost:${serverPort}/clip`, {
							base,
							startTime,
							endTime,
							ext,
						})
						.then((res) => {
							console.log(`\nProxy: ${ext} clip request successful:`, res.data);
						})
						.catch((err) => {
							console.error(`\nProxy: ${ext} clip request failed`, err);
						});
				} else {
					console.log(`\nProxy: Clip ${baseClipPath}.${ext} already exists.`);
				}
			}

			followUp();
		} catch (error) {
			console.error("\nProxy: Error forwarding request:", error);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.end("Internal Server Error");
			}
		}
	});

	req.on("error", (err) => {
		console.error("Proxy: Request error:", err);
	});
});

// -----------------------------------------------------
//#region main

server.listen(proxyPort, "localhost", () => {
	console.log(`Proxy: running at http://localhost:${proxyPort}`);
});

// -----------------------------------------------------
//#region utils

function parseUrl(url) {
	const err = { base: undefined, time: 0 };
	if (!url) return err;
	const hrefMatch = url.match(/href="([^"]+)"/);
	if (!hrefMatch) return err;
	const actualUrl = he.decode(hrefMatch[1]);
	if (!actualUrl) return err;
	const params = new URLSearchParams(actualUrl.split("?")[1]);
	if (!params) return err;
	return {
		base: params.get("base"),
		time: Number(params.get("time")),
	};
}
