'use strict'

let video = document.getElementById('video')
let subDiv = document.getElementById('subtitles')
let helpDiv = document.getElementById('help')
let burgerMessage = document.getElementById('burger-message')
let dummyDiv = document.getElementById('dummy')

let episodes = []
let index = 0
let cues = []
let subtitlesActive = true
let currentSubtitles = ''
let paused = true
let cursorTimeout
let dummyBool

let currentBase = ''
let currentStartTime = 0
let currentEndTime = 0

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
	
	currentBase = episodes[index]
	if (!currentBase) return
	video.src = `/video/${currentBase}`
	fetch( `/subtitles/${currentBase}`)
		.then(res => res.json())
		.then(data => {
			cues = data
		})
	
	updateUrl()
}

/* update URL with current state */

function updateUrl() {
	const url = new URL(window.location)
	url.searchParams.set('currentBase', currentBase)
	url.searchParams.set('currentStartTime', currentStartTime)
	url.searchParams.set('currentEndTime', currentEndTime)
	history.pushState(null, '', url.toString())
}

/* hide cursor */

function resetCursorTimer(force = true) {
	if (force || !cursorTimeout) {
		clearTimeout(cursorTimeout)
		cursorTimeout = null
		cursorTimeout = setTimeout(() => {
			if (!subDiv.matches(':hover') && !paused) {
				video.classList.add('hide-cursor')
			}
		}, 1500)
	}
}

resetCursorTimer()

document.addEventListener('mousemove', () => {
	video.classList.remove('hide-cursor')
	resetCursorTimer()
})

// helps when exiting/entering fullscreen, cursor shows up again, this updates the page
// comment it and the cursor can end up being stuck shown even though the hide-cursor class
// is there when subtitles are off
// when subtitles are on, they trigger events themselves by showing/hiding the subtitle div
setInterval(() => {
	if (!paused) {
		dummyBool = !dummyBool
		dummyDiv.style.display = (dummyBool) ? 'block' : 'none'
	}
}, 300)

/* update subtitles */

video.ontimeupdate = () => {
	let t = video.currentTime * 1000
	let cue = cues.find(c => t >= c.start && t <= c.end)
	let newSubtitle = cue ? cue.text.replace(/\r?\n/g, '\n') : ''
	if (newSubtitle !== currentSubtitles) {
		subDiv.innerText = newSubtitle
		currentSubtitles = newSubtitle
		if (currentSubtitles.length === 0) {
			subDiv.style.display = 'none'
			video.classList.add('hide-cursor')
		} else {
			if (subtitlesActive) {
				subDiv.style.display = 'block'
			}
			resetCursorTimer(false)
		}

		if (cue) {
			currentStartTime = cue.start
			currentEndTime = cue.end
		} else {
			currentStartTime = 0
			currentEndTime = 0
		}
		updateUrl()
	}
}

/* keybinds */

function togglePlay(e) {
	e.preventDefault()
	if (video.paused) {
		video.play()
		paused = false
		resetCursorTimer(false)
	} else {
		video.pause()
		paused = true
	}
}

function toggleFullscreen() {
	const hadHideCursor = video.classList.contains('hide-cursor')

	const restoreCursor = () => {
		if (hadHideCursor) {
			video.classList.remove('hide-cursor')
			setTimeout(() => {
				video.classList.add('hide-cursor')
			}, 1500)
		}
	}

	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen()
		.then(restoreCursor)
		.catch((err) => console.log(err))
	} else {
		document.exitFullscreen()
		.then(restoreCursor)
		.catch((err) => console.log(err))
	}
}

function toggleSubtitles() {
	subtitlesActive = !subtitlesActive
	subDiv.style.display = (subtitlesActive && currentSubtitles.length > 0) ? 'block' : 'none'
}

function toggleHelp() {
	helpDiv.style.display = (helpDiv.style.display === 'flex') ? 'none' : 'flex'
}

document.addEventListener('keydown', e => {
	switch (e.key) {
		case ' ':
			togglePlay(e)
			break
		case 'n':
		case 'N':
			loadEpisode(index + 1)
			break
		case 'p':
		case 'P':
			loadEpisode(index - 1)
			break
		case 'f':
		case 'F':
			toggleFullscreen()
			break
		case 'v':
		case 'V':
			toggleSubtitles()
			break
		case 'h':
		case 'H':
			toggleHelp()
			break
		case 'ArrowRight':
			video.currentTime += 5
			break
		case 'ArrowLeft':
			video.currentTime -= 5
			break
	}
})

/* pause when tabbed out */

document.addEventListener('visibilitychange', () => {
	if (document.hidden && !paused) {
		video.pause()
	} else if (!paused) {
		video.play()
	}
})

/* show burger message */

burgerMessage.style.display = 'block'
setTimeout(() => {
	burgerMessage.style.opacity = '0'
}, 100)
setTimeout(() => {
	burgerMessage.style.display = 'none'
}, 5100)
