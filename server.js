'use strict'

require('dotenv').config()

const path = require('path')

let mediaDir = process.argv[2]
let ankiMediaDir = process.env.ANKI_MEDIA_FOLDER || path.join(process.env.APPDATA, 'Roaming', 'Anki2', 'User 1', 'collection.media')
let currentBase
let currentStartTime
let currentEndTime

if (!mediaDir) {
	console.error('Please provide full path of the videos/subtitles folder as an argument.')
	process.exit(1)
}

const express = require('express')
const fs = require('fs')
const subtitle = require('subtitle')
const { exec } = require('child_process')

const app = express()
const port = process.env.SERVER_PORT

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

app.get('/video/:base', (req, res) => {
	console.log(`Server: /video/${req.params.base}`)
	const filePath = path.join(mediaDir, `${req.params.base}.mkv`)
	if (fs.existsSync(filePath)) res.sendFile(filePath)
	else res.status(404).send('Not found')
})

app.get('/subtitles/:base', (req, res) => {
	console.log(`Server: /subtitles/${req.params.base}`)
	const srtPath = path.join(mediaDir, `${req.params.base}.srt`)
	if (!fs.existsSync(srtPath)) return res.status(404).send('Not found')
	const srtContent = fs.readFileSync(srtPath, 'utf-8')
	const cues = subtitle.parse(srtContent)
	res.json(cues)
})

app.get('/episodes', (req, res) => {
	console.log(`Server: /episodes`)
	const files = fs.readdirSync(mediaDir)
	const mkvs = files.filter(f => f.endsWith('.mkv')).sort()
	const episodes = mkvs.map(f => {
		const base = f.replace(/\.mkv$/, '')
		return base
	})
	res.json(episodes)
})

app.post('/clip', (req, res) => {
	console.log(`Server: /clip`, req.body)
	const { base, startTime, endTime } = req.body
	if (!base || !startTime || !endTime) {
		return res.status(400).json({ error: 'base, startTime and endTime are required' })
	}

	const videoFile = path.join(mediaDir, `${base}.mkv`)

	if (!fs.existsSync(videoFile)) {
		return res.status(404).json({ error: `${videoFile} not found` })
	}

	const outputFile = path.join(ankiMediaDir, `${base}-${startTime}-${endTime}.mp4`)

	const ffmpegCommand = buildFFmpegCommand(videoFile, outputFile, startTime, endTime)

	exec(ffmpegCommand, (error, stdout, stderr) => {
		if (error) {
			return res.status(500).json({ error: `FFmpeg error: ${stderr}` })
		}

		res.json({ message: 'Video clipped successfully' })
	})
})

function getSubtitleForTimestamp(timestamp, cues) {
	const timestampInMs = timestamp * 1000
	return cues.find(cue => cue.start <= timestampInMs && cue.end >= timestampInMs)
}

function buildFFmpegCommand(inputFile, outputFile, startTime, endTime) {
    return `ffmpeg -i ${inputFile} -c:v libx264 -preset veryslow -crf 23 -vf "scale=-1:720" -ss ${startTime} -to ${endTime} -c:a aac -b:a 128k -movflags faststart ${outputFile}`
}

function normalizePath(raw) {
	let input = raw.trim()
		.replace(/^"|"$/g, '')
		.replace(/^'|'$/g, '')
		.replace(/\\/g, '/')

	if (/^[A-Za-z]:\//.test(input)) {
		input = input.replace(/^[A-Za-z]:/, `/mnt/${input[0].toLowerCase()}`)
	}

	return input
}

mediaDir = normalizePath(mediaDir)
if (!fs.existsSync(mediaDir) || !fs.lstatSync(mediaDir).isDirectory()) {
	console.error(`Server: Invalid folder: ${mediaDir}`)
	process.exit(1)
}

app.listen(port, () => {
	console.log(`Server: running at http://localhost:${port}`)
})

require('./proxy')
