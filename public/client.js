'use strict'

let video = document.getElementById('video')
let subDiv = document.getElementById('subtitles')
let helpDiv = document.getElementById('help')
let burgerMessage = document.getElementById('burger-message')

let episodes = []
let index = 0
let cues = []
let currentSubtitle = ''

fetch('/episodes')
	.then(res => res.json())
	.then(data => {
		episodes = data
		loadEpisode(index)
	})

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

video.ontimeupdate = () => {
	let t = video.currentTime * 1000
	let cue = cues.find(c => t >= c.start && t <= c.end)
	let newSubtitle = cue ? cue.text.replace(/\r?\n/g, '\n') : ''
	if (newSubtitle !== currentSubtitle) {
		subDiv.innerText = newSubtitle
		currentSubtitle = newSubtitle
	}
}

document.addEventListener('keydown', e => {
	if (e.key === ' ' || e.code === 'Space') {
		e.preventDefault()
		if (video.paused) {
			video.play()
		} else {
			video.pause()
		}
	}
	if (e.key === 'n') {
		loadEpisode(index + 1)
	}
	if (e.key === 'p') {
		loadEpisode(index - 1)
	}

	if (e.key === 'ArrowRight') {
		video.currentTime += 5
	}
	if (e.key === 'ArrowLeft') {
		video.currentTime -= 5
	}

	if (e.key === 'f' || e.key === 'F') {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch((err) => console.log(err));
		} else {
			document.exitFullscreen().catch((err) => console.log(err));
		}
	}

	if (e.key === 'v' || e.key === 'V') {
		subDiv.style.display = (subDiv.style.display === 'none') ? 'block' : 'none'
	}

	if (e.key === 'h' || e.key === 'H') {
		helpDiv.style.display = (helpDiv.style.display === 'flex') ? 'none' : 'flex'
	}
})

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		video.pause()
	} else {
		video.play()
	}
})

window.onload = () => {
	burgerMessage.style.display = 'block'
	setTimeout(() => {
		burgerMessage.style.opacity = '0'
	}, 100)
	setTimeout(() => {
		burgerMessage.style.display = 'none'
	}, 5100)
}
