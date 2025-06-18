'use strict'

let video = document.getElementById('video')
let subDiv = document.getElementById('subtitles')
let helpDiv = document.getElementById('help')
let burgerMessage = document.getElementById('burger-message')

let episodes = []
let index = 0
let cues = []
let currentSubtitle = ''
let paused = true
let cursorTimeout

fetch('/episodes')
	.then(res => res.json())
	.then(data => {
		episodes = data
		loadEpisode(index)
	})

/* episode change */

function loadEpisode(i) {
	if (i < 0) {
		index = episodes.length - 1
	} else if (i >= episodes.length) {
		index = 0
	} else {
		index = i
	}
	
	video.src = episodes[index].video
	fetch(episodes[index].subtitles)
		.then(res => res.json())
		.then(data => {
			cues = data
		});
}

/* hide cursor */

function resetCursorTimer() {
	clearTimeout(cursorTimeout)
	cursorTimeout = setTimeout(() => {
		if (!subDiv.matches(':hover') && !paused) {
			document.body.classList.add('hide-cursor')
		}
	}, 3000)
}

document.addEventListener('mousemove', () => {
	clearTimeout(cursorTimeout)
	document.body.classList.remove('hide-cursor')
	resetCursorTimer()
})

resetCursorTimer()

/* update subtitles */

video.ontimeupdate = () => {
	let t = video.currentTime * 1000
	let cue = cues.find(c => t >= c.start && t <= c.end)
	let newSubtitle = cue ? cue.text.replace(/\r?\n/g, '\n') : ''
	if (newSubtitle !== currentSubtitle) {
		subDiv.innerText = newSubtitle
		currentSubtitle = newSubtitle
		if (currentSubtitle === '') {
			subDiv.style.display = 'none'
		} else {
			subDiv.style.display = 'block'
		}
		resetCursorTimer()
	}
}

/* keybinds */

function togglePlay(e) {
	e.preventDefault()
	if (video.paused) {
		video.play()
		paused = false
		resetCursorTimer()
	} else {
		video.pause()
		paused = true
	}
}

function toggleFullscreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch((err) => console.log(err));
	} else {
		document.exitFullscreen().catch((err) => console.log(err));
	}
}

function toggleSubtitles() {
	subDiv.style.display = (subDiv.style.display === 'none') ? 'block' : 'none'
}

function toggleHelp() {
	helpDiv.style.display = (helpDiv.style.display === 'flex') ? 'none' : 'flex'
}

document.addEventListener('keydown', e => {
	switch (e.key) {
		case ' ':
			togglePlay(e);
			break;
		case 'n':
		case 'N':
			loadEpisode(index + 1);
			break;
		case 'p':
		case 'P':
			loadEpisode(index - 1);
			break;
		case 'f':
		case 'F':
			toggleFullscreen();
			break;
		case 'v':
		case 'V':
			toggleSubtitles();
			break;
		case 'h':
		case 'H':
			toggleHelp();
			break;
		case 'ArrowRight':
			video.currentTime += 5;
			break;
		case 'ArrowLeft':
			video.currentTime -= 5;
			break;
	}
});

/* pause when tabbed out */

document.addEventListener('visibilitychange', () => {
	if (document.hidden && !paused) {
		video.pause()
	} else if (!paused) {
		video.play()
	}
})

/* show burger message */

window.onload = () => {
	burgerMessage.style.display = 'block'
	setTimeout(() => {
		burgerMessage.style.opacity = '0'
	}, 100)
	setTimeout(() => {
		burgerMessage.style.display = 'none'
	}, 5100)
}
