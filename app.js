// app.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let tracks = [];
let trackId = 0;

function createTrack() {
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
        filterQ: 1
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
        Waveform: <select class="wave">
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
        Filter Type: <select class="filterType">
            <option value="lowpass" ${track.filterType === 'lowpass' ? 'selected' : ''}>Lowpass</option>
            <option value="highpass" ${track.filterType === 'highpass' ? 'selected' : ''}>Highpass</option>
            <option value="bandpass" ${track.filterType === 'bandpass' ? 'selected' : ''}>Bandpass</option>
        </select><br>
        Filter Freq: <input type="number" class="filterFreq" value="${track.filterFreq}" min="20" max="20000"> Hz<br>
        Filter Q: <input type="number" class="filterQ" value="${track.filterQ}" min="0.001" max="100" step="0.001"><br>
        <button class="play">Play</button>
        <button class="stop">Stop</button>
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

    // Connect: osc -> filter -> gain -> panner -> destination
    track.oscillator.connect(track.filterNode);
    track.filterNode.connect(track.gainNode);
    track.gainNode.connect(track.pannerNode);
    track.pannerNode.connect(audioCtx.destination);

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

    // Apply release
    const now = audioCtx.currentTime;
    track.gainNode.gain.cancelScheduledValues(now);
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
    track.gainNode.gain.linearRampToValueAtTime(0, now + track.release);

    setTimeout(() => {
        track.oscillator.stop();
        track.oscillator.disconnect();
        track.filterNode.disconnect();
        track.gainNode.disconnect();
        track.pannerNode.disconnect();
        track.isPlaying = false;
    }, track.release * 1000);
}

function removeTrack(track) {
    stopTrack(track);
    tracks = tracks.filter(t => t.id !== track.id);
    document.getElementById(`track-${track.id}`).remove();
}

document.getElementById('addTrack').addEventListener('click', createTrack);
document.getElementById('playAll').addEventListener('click', () => tracks.forEach(playTrack));
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
            const track = createTrack();
            Object.assign(track, config);
            renderTrack(track); // Re-render to update UI
            document.getElementById(`track-${track.id}`).remove(); // Remove and re-add with updates
            renderTrack(track);
        });
        alert('Configuration loaded!');
    } else {
        alert('No saved configuration found.');
    }
});