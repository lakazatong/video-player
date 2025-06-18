'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const subtitle = require('subtitle')

const app = express()
const port = 3000
let mediaDir = ''

app.use(express.static(path.join(__dirname, 'public')))

app.get('/video/:mkv', (req, res) => {
	const filePath = path.join(mediaDir, req.params.mkv)
	if (fs.existsSync(filePath)) res.sendFile(filePath)
	else res.status(404).send('Not found')
})

app.get('/subtitles/:srt', (req, res) => {
	const srtPath = path.join(mediaDir, req.params.srt)
	console.log(srtPath)
	if (!fs.existsSync(srtPath)) return res.status(404).send('Not found')
	const srtContent = fs.readFileSync(srtPath, 'utf-8')
	const cues = subtitle.parse(srtContent)
	res.json(cues)
})

app.get('/episodes', (req, res) => {
	const files = fs.readdirSync(mediaDir)
	const mkvs = files.filter(f => f.endsWith('.mkv')).sort()
	const episodes = mkvs.map(f => {
		const base = f.replace(/\.mkv$/, '')
		return {
			video: `/video/${base}.mkv`,
			subtitles: `/subtitles/${base}.srt`
		}
	})
	res.json(episodes)
})

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

function askFolder() {
	return require('inquirer').prompt([
		{
			type: 'input',
			name: 'folder',
			message: 'Enter the full path to the folder with your MKV and SRT files:',
			filter: normalizePath,
			validate: raw => {
				const input = normalizePath(raw)
				try {
					return fs.existsSync(input) && fs.lstatSync(input).isDirectory()
						? true
						: `Invalid folder: ${input}`
				} catch {
					return `Invalid folder: ${input}`
				}
			}
		}
	])
}

askFolder().then(answer => {
	mediaDir = path.resolve(answer.folder)
	app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`)
	})
})
