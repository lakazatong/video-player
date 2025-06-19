"use strict";

let video = document.getElementById("video");
let subDiv = document.getElementById("subtitles");
let helpDiv = document.getElementById("help");
let burgerMessage = document.getElementById("burger-message");
let dummyDiv = document.getElementById("dummy");
let customControls = document.getElementById("custom-controls");
let seeker = document.getElementById("seeker");
let currentTimeDisplay = document.getElementById("current-time");
let durationDisplay = document.getElementById("duration");

let episodes = [];
let index = 0;

let cues = [];
let offset = 0;

let volume = 1;
video.volume = volume;

let userPause = true;
let muted = false;

let currentBase = "";
let currentStartTime = 0;
let currentEndTime = 0;

fetch("/episodes")
	.then((res) => res.json())
	.then((data) => {
		episodes = data;
		loadEpisode(index);
	});

/* episode change */

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
	video.src = `/video/${currentBase}`;
	fetch(`/subtitles/${currentBase}`)
		.then((res) => res.json())
		.then((data) => {
			cues = data;
		});

	updateUrl();
}

/* hide cursor */

let cursorTimeout;

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

resetCursorTimer();

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

/* update subtitles */

let subtitlesActive = true;
let currentSubtitles = "";

video.ontimeupdate = () => {
	// subtitles

	let t = video.currentTime * 1000;
	let cue = cues.find((c) => t >= c.start && t <= c.end);
	let newSubtitle = cue ? cue.text.replace(/\r?\n/g, "\n") : "";

	if (newSubtitle !== currentSubtitles) {
		subDiv.innerText = newSubtitle;
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

		if (cue) {
			const currentCueIndex = cues.indexOf(cue);
			const previousCue = cues[currentCueIndex - 1];
			const nextCue = cues[currentCueIndex + 1];

			currentStartTime = Math.max(cue.start - 2500, previousCue ? previousCue.start : cue.start);
			currentEndTime = Math.min(cue.end + 2500, nextCue ? nextCue.end : cue.end);
		} else {
			currentStartTime = 0;
			currentEndTime = 0;
		}

		updateUrl();
	}

	// seeker

	seeker.value = video.currentTime;
	currentTimeDisplay.innerText = seekerTimeFormat(video.currentTime);
};

/* keybinds */

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
			subtitlesActive = !subtitlesActive;
			subDiv.style.display = subtitlesActive && currentSubtitles.length > 0 ? "block" : "none";
			break;
		case "s":
		case "S":
			customControls.style.display = customControls.style.display === "none" ? "flex" : "none";
			break;
		case "m":
		case "M":
			muted = !muted;
			video.volume = muted ? 0 : volume;
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
			} else {
				video.currentTime -= 5;
			}
			break;
		case "ArrowRight":
			if (e.shiftKey) {
				offset += 1;
			} else {
				video.currentTime += 5;
			}
			break;
		case "ArrowUp":
			volume = Math.min(1, volume + 0.05);
			if (!muted) video.volume = volume;
			break;
		case "ArrowDown":
			volume = Math.max(0, volume - 0.05);
			if (!muted) video.volume = volume;
			break;
		case "h":
		case "H":
			if (helpDiv.style.display === "flex") {
				helpDiv.style.display = "none";
				if (!userPause) video.play();
				resetCursorTimer(false);
			} else {
				helpDiv.style.display = "flex";
				video.pause();
			}

			break;
	}
});

/* show burger message */

burgerMessage.style.display = "block";
setTimeout(() => {
	burgerMessage.style.opacity = "0";
}, 100);
setTimeout(() => {
	burgerMessage.style.display = "none";
}, 5100);

/* pause when yomitan'ing */

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

/* pause when tabbed out */

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

/* custom controls */

video.addEventListener("loadedmetadata", () => {
	seeker.max = video.duration;
	durationDisplay.innerText = seekerTimeFormat(video.duration);
});

seeker.addEventListener("input", (e) => {
	video.currentTime = e.target.value;
});

function seekerTimeFormat(seconds) {
	let mins = Math.floor(seconds / 60);
	let secs = Math.floor(seconds % 60);
	return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
}

/* utils */

function updateUrl() {
	const url = new URL(window.location);
	url.searchParams.set("currentBase", currentBase);
	url.searchParams.set("currentStartTime", currentStartTime);
	url.searchParams.set("currentEndTime", currentEndTime);
	history.pushState(null, "", url.toString());
}
