"use strict";

require("dotenv").config();

const http = require("http");
const axios = require("axios");
const he = require("he");
const fs = require("fs");
const path = require("path");

/* args */

const serverPort = process.env.SERVER_PORT;
const ankiPort = process.env.ANKI_PORT;
const proxyPort = process.env.PROXY_PORT;

/* proxy */

const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
	});

	req.on("end", async () => {
		try {
			const headers = { ...req.headers };

			const data = body ? JSON.parse(body) : undefined;

			const urlHtml = data?.params?.note?.fields?.Url;
			const { base, startTime, endTime } = parseUrl(urlHtml);

			// console.log(
			// 	// `Proxy: received ${JSON.stringify(data?.action === "multi" ? data?.params?.actions : data?.action)}`,
			// 	data,
			// 	urlHtml
			// );

			if (
				req.method === "POST" &&
				req.url === "/" &&
				(data?.action === "addNote" || data?.action === "updateNoteFields") &&
				base
			) {
				console.log("\nProxy: Request from video-player client:", body);

				data.params.note.fields.Url = `${base}-${startTime}-${endTime}`;
				headers["content-length"] = Buffer.byteLength(JSON.stringify(data)).toString();

				// console.log("----------------------------------");
				// console.log(path.join(process.env.ANKI_MEDIA_FOLDER, data.params.note.fields.Url));
				// console.log("----------------------------------");

				const clipPath = path.join(process.env.ANKI_MEDIA_FOLDER, data.params.note.fields.Url);
				if (fs.existsSync(clipPath + ".mp4") || fs.existsSync(clipPath + ".webm")) {
					console.log(`\nProxy: Clip ${clipPath} already exists.`);
				} else {
					axios
						.post(`http://127.0.0.1:${serverPort}/clip`, {
							base,
							startTime,
							endTime,
						})
						.then((clipResponse) => {
							console.log("\nProxy: Clip request successful:", clipResponse.data);
						})
						.catch((clipError) => {
							console.error("\nProxy: Error during clip request:", clipError);
						});
				}
			}

			const axiosConfig = {
				method: req.method,
				url: `http://127.0.0.1:${ankiPort}${req.url}`,
				headers: headers,
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

/* main */

server.listen(proxyPort, "127.0.0.1", () => {
	console.log(`Proxy: running at http://127.0.0.1:${proxyPort}`);
});

/* utils */

function parseUrl(url) {
	const err = { base: undefined, startTime: 0, endTime: 0 };
	if (!url) return err;
	const hrefMatch = url.match(/href="([^"]+)"/);
	if (!hrefMatch) return err;
	const actualUrl = he.decode(hrefMatch[1]);
	if (!actualUrl) return err;
	const params = new URLSearchParams(actualUrl.split("?")[1]);
	if (!params) return err;
	return {
		base: params.get("currentBase"),
		startTime: Number(params.get("currentStartTime")),
		endTime: Number(params.get("currentEndTime")),
	};
}
