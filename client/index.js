"use strict";

// -----------------------------------------------------
//#region elements

let video = document.getElementById("video");
let source = video.querySelector("source");
let subDiv = document.getElementById("subtitles");
let helpDiv = document.getElementById("help");
let dummyDiv = document.getElementById("dummy");
let controls = document.getElementById("controls");
let seeker = document.getElementById("seeker");
let currentTimeDisplay = document.getElementById("current-time");
let durationDisplay = document.getElementById("duration");
let volumeBurger = document.getElementById("burger-volume");
let helpBurger = document.getElementById("burger-help");

// -----------------------------------------------------
//#region globals

// episode

let episodes = [];
let index = 0;

let currentBase = "";

// subtitles

let cues = [];
let offset = 0;

let subtitlesActive = true;

let currentSubtitles = "";
let currentStartTime = 0;
let currentEndTime = 0;

// volume

let volume = 1;
video.volume = volume;

// user controls

let userPause = true;
let muted = false;
let seekerLeft;
let seekerRight;

// timeouts

let cursorTimeout;

// -----------------------------------------------------
//#region init

fetch("/episodes")
	.then((res) => res.json())
	.then((data) => {
		episodes = data;
		loadEpisode(index);
	});

flashBurgerMessage(helpBurger);
resetCursorTimer();

// -----------------------------------------------------
//#region episode change

function loadEpisode(i) {
	if (i < 0) {
		index = episodes.length - 1;
	} else if (i >= episodes.length) {
		index = 0;
	} else {
		index = i;
	}

	currentBase = episodes[index];
	if (!currentBase) return;

	fetch(`/video/${currentBase}`)
		.then((res) => res.blob())
		.then((blob) => {
			source.src = URL.createObjectURL(blob);
		});

	fetch(`/subtitles/${currentBase}`)
		.then((res) => res.json())
		.then((data) => {
			cues = data.map((cue) => ({ ...cue, text: cue.text.replace(/\r?\n/g, "\n") }));
		});

	updateUrl();
	updateTitle();
}

// -----------------------------------------------------
//#region hide cursor

function resetCursorTimer(force = true) {
	if (force || !cursorTimeout) {
		clearTimeout(cursorTimeout);
		cursorTimeout = null;
		cursorTimeout = setTimeout(() => {
			if (!subDiv.matches(":hover") && !video.paused) {
				video.classList.add("hide-cursor");
			}
		}, 1500);
	}
}

document.addEventListener("mousemove", () => {
	video.classList.remove("hide-cursor");
	resetCursorTimer();
});

// helps when exiting/entering fullscreen, cursor shows up again, this updates the page
// comment it and the cursor can end up being stuck shown even though the hide-cursor class
// is there when subtitles are off
// when subtitles are on, they trigger events themselves by showing/hiding the subtitle div
setInterval(() => {
	if (!video.paused) dummyDiv.style.display = dummyDiv.style.display === "none" ? "block" : "none";
}, 300);

// -----------------------------------------------------
//#region toggles

function togglePlay(e) {
	e.preventDefault();
	if (video.paused) {
		video.play();
		userPause = false;
		resetCursorTimer(false);
	} else {
		video.pause();
		userPause = true;
	}
}

function toggleFullscreen() {
	const hadHideCursor = video.classList.contains("hide-cursor");

	const restoreCursor = () => {
		if (hadHideCursor) {
			video.classList.remove("hide-cursor");
			setTimeout(() => {
				video.classList.add("hide-cursor");
			}, 1500);
		}
	};

	if (!document.fullscreenElement) {
		document.documentElement
			.requestFullscreen()
			.then(restoreCursor)
			.catch((err) => console.log(err));
	} else {
		document
			.exitFullscreen()
			.then(restoreCursor)
			.catch((err) => console.log(err));
	}
}

function toggleSubtitles() {
	subtitlesActive = !subtitlesActive;
	subDiv.style.display = subtitlesActive && currentSubtitles.length > 0 ? "block" : "none";
}

function toggleControls() {
	controls.style.display = controls.style.display === "none" ? "flex" : "none";
}

function toggleMuted() {
	muted = !muted;
	video.volume = muted ? 0 : volume;
	updateTitle();
}

function toggleHelp() {
	if (helpDiv.style.display === "flex") {
		helpDiv.style.display = "none";
		if (!userPause) video.play();
		resetCursorTimer(false);
	} else {
		helpDiv.style.display = "flex";
		video.pause();
	}
}

// -----------------------------------------------------
//#region keybinds

document.addEventListener("keydown", (e) => {
	switch (e.key) {
		case " ":
			togglePlay(e);
			break;
		case "f":
		case "F":
			toggleFullscreen();
			break;
		case "v":
		case "V":
			toggleSubtitles();
			break;
		case "s":
		case "S":
			toggleControls();
			break;
		case "m":
		case "M":
			toggleMuted();
			flashVolumeBurger(volumeBurger);
			break;
		case "p":
		case "P":
			loadEpisode(index - 1);
			break;
		case "n":
		case "N":
			loadEpisode(index + 1);
			break;
		case "ArrowLeft":
			if (e.shiftKey) {
				offset -= 1;
				updateSubtitles();
			} else {
				seeker.value = Math.max(0, parseInt(seeker.value) - 5).toString();
				seekerUpdated();
			}
			break;
		case "ArrowRight":
			if (e.shiftKey) {
				offset += 1;
				updateSubtitles();
			} else {
				seeker.value = Math.min(parseInt(seeker.max), parseInt(seeker.value) + 5).toString();
				seekerUpdated();
			}
			break;
		case "ArrowUp":
			volume = Math.min(1, volume + 0.05);
			if (!muted) {
				video.volume = volume;
				updateTitle();
			}
			flashVolumeBurger(volumeBurger);
			break;
		case "ArrowDown":
			volume = Math.max(0, volume - 0.05);
			if (!muted) {
				video.volume = volume;
				updateTitle();
			}
			flashVolumeBurger(volumeBurger);
			break;
		case "h":
		case "H":
			toggleHelp();
			break;
	}
});

// -----------------------------------------------------
//#region auto pause

// when yomitan'ing

let onSubs = false;

function getSelect() {
	return window.getSelection().toString().trim();
}

subDiv.addEventListener("mouseenter", () => {
	video.pause();
	onSubs = true;
});

subDiv.addEventListener("mouseleave", () => {
	if (!userPause && getSelect().length === 0) video.play();
	onSubs = false;
});

document.addEventListener("selectionchange", () => {
	if (getSelect()) {
		video.pause();
	} else if (!userPause) {
		video.play();
	}
});

// when tabbed out

document.addEventListener("visibilitychange", () => {
	if (userPause) return;
	if (document.hidden) {
		video.pause();
	} else if (!onSubs && getSelect().length === 0) {
		video.play();
	}
});

window.addEventListener("blur", () => {
	video.pause();
});

window.addEventListener("focus", () => {
	if (!userPause && !onSubs && getSelect().length === 0) video.play();
});

// -----------------------------------------------------
//#region controls

video.addEventListener("loadedmetadata", () => {
	seeker.value = "0";
	seeker.max = video.duration.toString();
	// seekerLeft = 5 / seeker.max;
	// seekerRight = seekerLeft;
	// console.log(seekerLeft, seeker.max);
	durationDisplay.innerText = seekerTimeFormat(seeker.max);
});

seeker.addEventListener("input", seekerUpdated);

function seekerTimeFormat(seconds) {
	seconds = typeof seconds === "string" ? parseInt(seconds) : seconds;
	let mins = Math.floor(seconds / 60);
	let secs = Math.floor(seconds % 60);
	return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
}

// -----------------------------------------------------
//#region updates

function updateUrl() {
	const url = new URL(window.location);
	url.searchParams.set("base", currentBase);
	url.searchParams.set("time", seeker.value * 1000 + offset);
	history.pushState(null, "", url.toString());
}

function updateTitle() {
	document.title = `${currentBase} ${Math.round(video.volume * 100)}%`;
}

function updateSubtitles() {
	const time = seeker.value * 1000 + offset;
	const newSubtitle = cues.find((c) => time >= c.start && time <= c.end)?.text || "";

	if (newSubtitle === currentSubtitles) return;

	currentSubtitles = newSubtitle;

	if (currentSubtitles.length === 0) {
		subDiv.style.display = "none";
		video.classList.add("hide-cursor");
	} else {
		if (subtitlesActive) {
			subDiv.style.display = "block";
		}

		resetCursorTimer(false);
	}
	subDiv.innerText = currentSubtitles;

	updateUrl();
}

function seekerUpdated() {
	video.currentTime = seeker.value;
	currentTimeDisplay.innerText = seekerTimeFormat(seeker.value);
	updateSubtitles();
}

// -----------------------------------------------------
//#region burger message

function flashBurgerMessage(
	el,
	keyframes = [
		[1, 0],
		[1, 1000],
		[0, 5000],
	]
) {
	const total = keyframes[keyframes.length - 1][1];

	const normalizedFrames = keyframes.map(([opacity, time]) => ({
		opacity,
		offset: time / total,
	}));

	el.animate(normalizedFrames, {
		duration: total,
		easing: "linear",
		fill: "forwards",
	});
}

function flashVolumeBurger() {
	volumeBurger.innerText = `${muted ? "🔇" : "🔊"} Volume: ${Math.round(volume * 100)}%`;
	flashBurgerMessage(volumeBurger, [
		[1, 0],
		[1, 750],
		[0, 1500],
	]);
}
