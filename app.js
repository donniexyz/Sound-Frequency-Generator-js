// app.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let tracks = [];
let trackId = 0;

// Visualization variables
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
let vizType = 'waveform'; // 'waveform', 'frequency', 'off'
let animationId;

// Connect master output to analyser, then to destination
// We need a master gain node to easily route everything through the analyser
const masterGain = audioCtx.createGain();
masterGain.connect(analyser);
analyser.connect(audioCtx.destination);

function createTrack(config = {}) {
    const track = {
        id: trackId++,
        oscillator: null,
        gainNode: null,
        pannerNode: null,
        isPlaying: false,
        isMuted: false,
        frequency: 440,
        waveform: 'sine', // sine, square, sawtooth, triangle
        volume: 0.5,
        pan: 0,
        detune: 0,
        attack: 0.1,
        decay: 0.1,
        sustain: 0.5,
        release: 0.1,
        filterType: 'lowpass', // lowpass, highpass, bandpass
        filterFreq: 1000,
        filterQ: 1,
        ...config
    };

    renderTrack(track);
    tracks.push(track);
    return track;
}

function renderTrack(track) {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    trackDiv.id = `track-${track.id}`;
    trackDiv.innerHTML = `
        <h3>Track ${track.id + 1}</h3>
        Frequency: <input type="number" class="freq" value="${track.frequency}" min="20" max="20000"> Hz<br>
        Waveform: <select class="wave"> <!-- sine, square, sawtooth, triangle -->
            <option value="sine" ${track.waveform === 'sine' ? 'selected' : ''}>Sine</option>
            <option value="square" ${track.waveform === 'square' ? 'selected' : ''}>Square</option>
            <option value="sawtooth" ${track.waveform === 'sawtooth' ? 'selected' : ''}>Sawtooth</option>
            <option value="triangle" ${track.waveform === 'triangle' ? 'selected' : ''}>Triangle</option>
        </select><br>
        Volume: <input type="range" class="vol" min="0" max="1" step="0.01" value="${track.volume}"><br>
        Pan: <input type="range" class="pan" min="-1" max="1" step="0.01" value="${track.pan}"><br>
        Detune: <input type="number" class="detune" value="${track.detune}" min="-1200" max="1200"> cents<br>
        Mute: <input type="checkbox" class="mute" ${track.isMuted ? 'checked' : ''}><br>
        Attack: <input type="number" class="attack" value="${track.attack}" min="0" step="0.01"> s<br>
        Decay: <input type="number" class="decay" value="${track.decay}" min="0" step="0.01"> s<br>
        Sustain: <input type="range" class="sustain" min="0" max="1" step="0.01" value="${track.sustain}"><br>
        Release: <input type="number" class="release" value="${track.release}" min="0" step="0.01"> s<br>
        Filter Type: <select class="filterType"> <!-- lowpass, highpass, bandpass -->
            <option value="lowpass" ${track.filterType === 'lowpass' ? 'selected' : ''}>Lowpass</option>
            <option value="highpass" ${track.filterType === 'highpass' ? 'selected' : ''}>Highpass</option>
            <option value="bandpass" ${track.filterType === 'bandpass' ? 'selected' : ''}>Bandpass</option>
        </select><br>
        Filter Freq: <input type="number" class="filterFreq" value="${track.filterFreq}" min="20" max="20000"> Hz<br>
        Filter Q: <input type="number" class="filterQ" value="${track.filterQ}" min="0.001" max="100" step="0.001"><br>
        <button class="play" ${track.isPlaying ? 'disabled' : ''}>Play</button>
        <button class="stop" ${!track.isPlaying ? 'disabled' : ''}>Stop</button>
        <button class="remove">Remove</button>
    `;

    // Event listeners
    trackDiv.querySelector('.freq').addEventListener('input', (e) => { track.frequency = parseFloat(e.target.value); if (track.isPlaying) updateOscillator(track); });
    trackDiv.querySelector('.wave').addEventListener('change', (e) => { track.waveform = e.target.value; if (track.isPlaying) updateOscillator(track); });
    trackDiv.querySelector('.vol').addEventListener('input', (e) => { track.volume = parseFloat(e.target.value); if (track.gainNode) track.gainNode.gain.value = track.isMuted ? 0 : track.volume; });
    trackDiv.querySelector('.pan').addEventListener('input', (e) => { track.pan = parseFloat(e.target.value); if (track.pannerNode) track.pannerNode.pan.value = track.pan; });
    trackDiv.querySelector('.detune').addEventListener('input', (e) => { track.detune = parseFloat(e.target.value); if (track.oscillator) track.oscillator.detune.value = track.detune; });
    trackDiv.querySelector('.mute').addEventListener('change', (e) => { track.isMuted = e.target.checked; if (track.gainNode) track.gainNode.gain.value = track.isMuted ? 0 : track.volume; });
    trackDiv.querySelector('.attack').addEventListener('input', (e) => track.attack = parseFloat(e.target.value));
    trackDiv.querySelector('.decay').addEventListener('input', (e) => track.decay = parseFloat(e.target.value));
    trackDiv.querySelector('.sustain').addEventListener('input', (e) => track.sustain = parseFloat(e.target.value));
    trackDiv.querySelector('.release').addEventListener('input', (e) => track.release = parseFloat(e.target.value));
    trackDiv.querySelector('.filterType').addEventListener('change', (e) => { track.filterType = e.target.value; if (track.isPlaying) updateFilter(track); });
    trackDiv.querySelector('.filterFreq').addEventListener('input', (e) => { track.filterFreq = parseFloat(e.target.value); if (track.filterNode) track.filterNode.frequency.value = track.filterFreq; });
    trackDiv.querySelector('.filterQ').addEventListener('input', (e) => { track.filterQ = parseFloat(e.target.value); if (track.filterNode) track.filterNode.Q.value = track.filterQ; });

    trackDiv.querySelector('.play').addEventListener('click', () => playTrack(track));
    trackDiv.querySelector('.stop').addEventListener('click', () => stopTrack(track));
    trackDiv.querySelector('.remove').addEventListener('click', () => removeTrack(track));

    document.getElementById('tracks').appendChild(trackDiv);
}

function updateOscillator(track) {
    if (track.oscillator) {
        track.oscillator.frequency.value = track.frequency;
        track.oscillator.type = track.waveform;
        track.oscillator.detune.value = track.detune;
    }
}

function updateFilter(track) {
    if (track.filterNode) {
        track.filterNode.type = track.filterType;
        track.filterNode.frequency.value = track.filterFreq;
        track.filterNode.Q.value = track.filterQ;
    }
}

function playTrack(track) {
    if (track.isPlaying) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const trackDiv = document.getElementById(`track-${track.id}`);
    if (trackDiv) {
        trackDiv.querySelector('.play').disabled = true;
        trackDiv.querySelector('.stop').disabled = false;
    }

    track.oscillator = audioCtx.createOscillator();
    track.oscillator.type = track.waveform;
    track.oscillator.frequency.value = track.frequency;
    track.oscillator.detune.value = track.detune;

    track.gainNode = audioCtx.createGain();
    track.gainNode.gain.value = 0; // Start at 0 for envelope

    track.pannerNode = audioCtx.createStereoPanner();
    track.pannerNode.pan.value = track.pan;

    track.filterNode = audioCtx.createBiquadFilter();
    track.filterNode.type = track.filterType;
    track.filterNode.frequency.value = track.filterFreq;
    track.filterNode.Q.value = track.filterQ;

    // Connect: osc -> filter -> gain -> panner -> masterGain (instead of destination)
    track.oscillator.connect(track.filterNode);
    track.filterNode.connect(track.gainNode);
    track.gainNode.connect(track.pannerNode);
    track.pannerNode.connect(masterGain); // Route to masterGain for visualization

    track.oscillator.start();
    track.isPlaying = true;

    // Apply ADSR envelope
    const now = audioCtx.currentTime;
    track.gainNode.gain.cancelScheduledValues(now);
    track.gainNode.gain.setValueAtTime(0, now);
    track.gainNode.gain.linearRampToValueAtTime(track.isMuted ? 0 : track.volume, now + track.attack);
    track.gainNode.gain.linearRampToValueAtTime(track.isMuted ? 0 : track.volume * track.sustain, now + track.attack + track.decay);
}

function stopTrack(track) {
    if (!track.isPlaying) return;

    const trackDiv = document.getElementById(`track-${track.id}`);
    if (trackDiv) {
        trackDiv.querySelector('.stop').disabled = true;
    }

    // Apply release
    const now = audioCtx.currentTime;
    track.gainNode.gain.cancelScheduledValues(now);
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
    track.gainNode.gain.linearRampToValueAtTime(0, now + track.release);

    setTimeout(() => {
        if (track.oscillator) {
            track.oscillator.stop();
            track.oscillator.disconnect();
        }
        if (track.filterNode) track.filterNode.disconnect();
        if (track.gainNode) track.gainNode.disconnect();
        if (track.pannerNode) track.pannerNode.disconnect();
        
        track.isPlaying = false;
        track.oscillator = null;
        track.gainNode = null;
        track.pannerNode = null;
        track.filterNode = null;
        
        const currentTrackDiv = document.getElementById(`track-${track.id}`);
        if (currentTrackDiv) {
            currentTrackDiv.querySelector('.play').disabled = false;
        }
    }, track.release * 1000);
}

function removeTrack(track) {
    stopTrack(track);
    tracks = tracks.filter(t => t.id !== track.id);
    document.getElementById(`track-${track.id}`).remove();
}

// Visualization Logic
function draw() {
    animationId = requestAnimationFrame(draw);

    if (vizType === 'off') {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    canvasCtx.fillStyle = 'rgb(0, 0, 0)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    if (vizType === 'waveform') {
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 255, 0)';
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    } else if (vizType === 'frequency') {
        analyser.getByteFrequencyData(dataArray);
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;

            canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }
}

document.getElementById('vizType').addEventListener('change', (e) => {
    vizType = e.target.value;
});

// Start visualization loop
draw();

document.getElementById('addTrack').addEventListener('click', () => createTrack());
document.getElementById('playAll').addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    tracks.forEach(playTrack);
});
document.getElementById('stopAll').addEventListener('click', () => tracks.forEach(stopTrack));

document.getElementById('save').addEventListener('click', () => {
    localStorage.setItem('tracksConfig', JSON.stringify(tracks.map(t => ({
        frequency: t.frequency,
        waveform: t.waveform,
        volume: t.volume,
        pan: t.pan,
        detune: t.detune,
        isMuted: t.isMuted,
        attack: t.attack,
        decay: t.decay,
        sustain: t.sustain,
        release: t.release,
        filterType: t.filterType,
        filterFreq: t.filterFreq,
        filterQ: t.filterQ
    }))));
    alert('Configuration saved!');
});

document.getElementById('load').addEventListener('click', () => {
    const saved = localStorage.getItem('tracksConfig');
    if (saved) {
        const configs = JSON.parse(saved);
        tracks.forEach(stopTrack);
        document.getElementById('tracks').innerHTML = '';
        tracks = [];
        trackId = 0;
        configs.forEach(config => {
            createTrack(config);
        });
        alert('Configuration loaded!');
    } else {
        alert('No saved configuration found.');
    }
});