"use strict";

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

function getMIME(ext) {
	if (ext === "mkv") return "x-matroska";
	if (ext === "3gp") return "3gpp";
	return ext;
}

const type1 = [];
const type2 = [];

for (const format in formatsEncoders) {
	type1.push("");
	type2.push("");
	formatsEncoders[format].forEach(([videoEncoder, audioEncoder]) => {
		const filename = `{{Url}}-${videoEncoder}-${audioEncoder}.${format}`;
		const label = `${format.toUpperCase()} (${videoEncoder}, ${audioEncoder})`;
		const type = `video/${getMIME(format)}`;
		type1.push(`<h3>${label}</h3> <video controls autoplay><source src="${filename}" type="${type}" /></video>`);
		type2.push(`<h3>${label}</h3> <video src="${filename}" controls autoplay></video>`);
	});
}

for (const line of type1) console.log(line);
console.log();
for (let i = 0; i <= 10; i++) console.log(`<br />`);
for (const line of type2) console.log(line);
