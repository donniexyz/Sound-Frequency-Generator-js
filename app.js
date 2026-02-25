// app.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let tracks = [];
let trackId = 0;

// Visualization variables
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
// We use fftSize for time domain to get more detail, but frequencyBinCount (half fftSize) for frequency data.
// To keep it simple and consistent with previous code, we'll use a buffer large enough for the FFT size for waveform,
// but we only need half for frequency.
const bufferLength = analyser.frequencyBinCount; // 1024
const dataArray = new Uint8Array(analyser.fftSize); // Use larger buffer to accommodate full waveform if needed
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
let vizType = 'waveform'; // 'waveform', 'frequency', 'off'
let vizScale = 1;
let vizTimeScale = 1; // 1 = full buffer, >1 = zoomed in
let showGrid = true;
let isFrozen = false;
let animationId;

// Connect master output to analyser, then to destination
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

    // Connect: osc -> filter -> gain -> panner -> masterGain
    track.oscillator.connect(track.filterNode);
    track.filterNode.connect(track.gainNode);
    track.gainNode.connect(track.pannerNode);
    track.pannerNode.connect(masterGain);

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
function drawGrid(type) {
    if (!showGrid) return;

    canvasCtx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    canvasCtx.lineWidth = 1;
    canvasCtx.fillStyle = 'rgba(200, 200, 200, 0.8)';
    canvasCtx.font = '10px Arial';
    canvasCtx.textAlign = 'center';

    const width = canvas.width;
    const height = canvas.height;

    if (type === 'frequency') {
        // Logarithmic Grid
        const minFreq = 20;
        const maxFreq = audioCtx.sampleRate / 2;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);

        const getX = (freq) => {
            const logFreq = Math.log10(freq);
            return ((logFreq - logMin) / (logMax - logMin)) * width;
        };

        // Draw decades (100, 1k, 10k) and some intermediate values
        const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        freqs.forEach(freq => {
            const x = getX(freq);
            if (x >= 0 && x <= width) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(x, 0);
                canvasCtx.lineTo(x, height);
                canvasCtx.stroke();
                
                let label = freq >= 1000 ? (freq/1000) + 'k' : freq;
                canvasCtx.fillText(label, x, height - 5);
            }
        });
    } else if (type === 'waveform') {
        // Time Grid
        // We are displaying 'analyser.fftSize' samples (or bufferLength if we used that)
        // Let's use fftSize for the full window duration
        const duration = (analyser.fftSize / audioCtx.sampleRate) / vizTimeScale; // seconds
        const msDuration = duration * 1000;
        
        // Draw lines every 10ms (or adjust based on zoom)
        // If zoomed in, we might want finer grid
        let step = 10;
        if (vizTimeScale > 2) step = 5;
        if (vizTimeScale > 5) step = 1;

        for (let t = 0; t < msDuration; t += step) {
            const x = (t / msDuration) * width;
            canvasCtx.beginPath();
            canvasCtx.moveTo(x, 0);
            canvasCtx.lineTo(x, height);
            canvasCtx.stroke();
            canvasCtx.fillText(Math.round(t) + 'ms', x, height - 5);
        }
        
        // Amplitude Grid (Horizontal)
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height/2);
        canvasCtx.lineTo(width, height/2);
        canvasCtx.stroke();
    }
}

function draw() {
    animationId = requestAnimationFrame(draw);

    if (vizType === 'off') {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // If frozen, we just redraw the existing dataArray (which isn't being updated)
    // But we still need to clear and redraw in case settings (scale, grid) changed.
    // If NOT frozen, we update dataArray.
    if (!isFrozen) {
        if (vizType === 'waveform') {
            analyser.getByteTimeDomainData(dataArray);
        } else if (vizType === 'frequency') {
            analyser.getByteFrequencyData(dataArray);
        }
    }

    canvasCtx.fillStyle = 'rgb(0, 0, 0)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(vizType);

    if (vizType === 'waveform') {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 255, 0)';
        canvasCtx.beginPath();

        // We want to display the full buffer (fftSize)
        // If vizTimeScale > 1, we only display a portion of the buffer
        const displayLength = Math.floor(analyser.fftSize / vizTimeScale);
        const sliceWidth = canvas.width * 1.0 / displayLength;
        let x = 0;

        for (let i = 0; i < displayLength; i++) {
            let v = dataArray[i];
            let centered = v - 128;
            centered = centered * vizScale;
            
            const y = (centered + 128) / 255.0 * canvas.height;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.stroke();

    } else if (vizType === 'frequency') {
        const width = canvas.width;
        const height = canvas.height;
        const minFreq = 20;
        const maxFreq = audioCtx.sampleRate / 2;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        
        canvasCtx.fillStyle = 'rgb(255, 50, 50)';
        
        for (let x = 0; x < width; x++) {
            const logFreq = (x / width) * (logMax - logMin) + logMin;
            const freq = Math.pow(10, logFreq);
            
            const binIndex = Math.round(freq * analyser.fftSize / audioCtx.sampleRate);
            
            if (binIndex >= 0 && binIndex < bufferLength) {
                const value = dataArray[binIndex];
                const barHeight = (value * vizScale) / 255 * height;
                
                canvasCtx.fillRect(x, height - barHeight, 1, barHeight);
            }
        }
    }
}

document.getElementById('vizType').addEventListener('change', (e) => {
    vizType = e.target.value;
    // Show/Hide Time Scale control based on type
    const timeScaleGroup = document.getElementById('timeScaleGroup');
    if (vizType === 'waveform') {
        timeScaleGroup.style.display = 'flex';
    } else {
        timeScaleGroup.style.display = 'none';
    }
    // Unfreeze when changing type to avoid confusion
    isFrozen = false;
    document.getElementById('vizFreeze').textContent = 'Freeze';
});

document.getElementById('vizScale').addEventListener('input', (e) => {
    vizScale = parseFloat(e.target.value);
});

document.getElementById('vizTimeScale').addEventListener('input', (e) => {
    vizTimeScale = parseFloat(e.target.value);
});

document.getElementById('vizGrid').addEventListener('change', (e) => {
    showGrid = e.target.checked;
});

document.getElementById('vizFreeze').addEventListener('click', (e) => {
    isFrozen = !isFrozen;
    e.target.textContent = isFrozen ? 'Unfreeze' : 'Freeze';
});

// Initialize UI state
document.getElementById('vizType').dispatchEvent(new Event('change'));

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