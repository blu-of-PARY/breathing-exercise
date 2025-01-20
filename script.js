if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/breathing-exercise/service-worker.js')
            .then(() => console.log('ServiceWorker registration successful'))
            .catch(err => console.error('ServiceWorker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    let isRunning = false;
    let isPaused = false;
    let currentCycle = 0;
    let totalCycles = 10;
    let timer = null;
    let stream = null;
    let mediaRecorder = null;
    const chunks = [];
    let currentPhaseIndex = 0;
    let currentTimeLeft = 0;

    const elements = {
        video: document.getElementById('webcam'),
        readyBtn: document.getElementById('readyBtn'),
        startBtn: document.getElementById('startBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        stopBtn: document.getElementById('stopBtn'),
        instruction: document.querySelector('.instruction-message'),
        exerciseControls: document.querySelector('.exercise-controls'),
        countDisplay: document.getElementById('countNumber'),
        phaseName: document.querySelector('.phase-name'),
        progress: document.querySelector('.timer-progress'),
        cycleCount: document.getElementById('cycleCount'),
        currentCycleDisplay: document.getElementById('currentCycle'),
        totalCyclesDisplay: document.getElementById('totalCycles')
    };

    // 사이클 카운트 입력 이벤트 리스너 추가
    elements.cycleCount.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (value > 50) {
            e.target.value = 50;
            totalCycles = 50;
        } else if (value < 1) {
            e.target.value = 1;
            totalCycles = 1;
        } else {
            totalCycles = value;
        }
        elements.totalCyclesDisplay.textContent = totalCycles;
    });

    // max 속성 변경
    elements.cycleCount.setAttribute('max', '50');

    const breathingPhases = [
        { name: '준비', text: '자세를 잡고 호흡을 준비하세요.', time: 3 },
        { name: '들이쉬기', text: '숨을 천천히 들이마셔 주세요.', time: 7 },
        { name: '참기', text: '숨을 잠시 멈추세요.', time: 5 },
        { name: '내쉬기', text: '숨을 천천히 내쉬어 주세요.', time: 7 },
    ];

    async function initCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.video.srcObject = stream;

            await elements.video.play();

            const options = { mimeType: 'video/webm; codecs=vp8' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`MIME 타입 ${options.mimeType}이 지원되지 않습니다. 대체 타입 사용.`);
                options.mimeType = 'video/mp4';
            }

            mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: options.mimeType });
                const fileName = `recorded-video-${new Date()
                    .toISOString()
                    .replace(/[:.]/g, '-')}.webm`;
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

            elements.readyBtn.style.display = 'none';
            elements.exerciseControls.style.display = 'flex';
            elements.instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';
        } catch (err) {
            console.error('Camera initialization error:', err);
            alert('카메라 초기화 중 오류가 발생했습니다: ' + err.message);
        }
    }

    function startBreathingCycle(resumeFrom = null) {
        if (resumeFrom) {
            currentPhaseIndex = resumeFrom.phaseIndex;
            currentTimeLeft = resumeFrom.timeLeft;
        } else {
            currentPhaseIndex = 0;
            currentTimeLeft = breathingPhases[0].time;
        }

        function updateTimer() {
            if (!isRunning || isPaused) return;

            const phase = breathingPhases[currentPhaseIndex];
            elements.phaseName.textContent = phase.name;
            elements.instruction.textContent = phase.text;
            elements.countDisplay.textContent = currentTimeLeft;

            const totalTime = breathingPhases.reduce((sum, phase) => sum + phase.time, 0);
            const elapsedTime = breathingPhases
                .slice(0, currentPhaseIndex)
                .reduce((sum, phase) => sum + phase.time, 0) +
                (breathingPhases[currentPhaseIndex].time - currentTimeLeft);
            const progressWidth = (elapsedTime / totalTime) * 100;
            elements.progress.style.width = `${progressWidth}%`;

            currentTimeLeft--;

            if (currentTimeLeft < 0) {
                currentPhaseIndex++;
                if (currentPhaseIndex >= breathingPhases.length) {
                    currentCycle++;
                    elements.currentCycleDisplay.textContent = currentCycle;
                    if (currentCycle >= totalCycles) {
                        stopExercise();
                        return;
                    }
                    currentPhaseIndex = 0;
                }
                currentTimeLeft = breathingPhases[currentPhaseIndex].time;
            }
        }

        if (timer) {
            clearInterval(timer);
        }
        timer = setInterval(updateTimer, 1000);
    }

    function startExercise() {
        if (!stream) {
            alert('카메라가 활성화되지 않았습니다. 먼저 "준비 완료"를 누르세요.');
            return;
        }

        isRunning = true;
        isPaused = false;
        currentCycle = 0;
        elements.currentCycleDisplay.textContent = '0';
        elements.startBtn.style.display = 'none';
        elements.pauseBtn.style.display = 'block';
        elements.stopBtn.style.display = 'block';

        mediaRecorder.start();
        console.log('녹화 시작됨');

        startBreathingCycle();
    }

    function pauseExercise() {
        if (isPaused) {
            isPaused = false;
            elements.pauseBtn.textContent = '일시정지';
            console.log('운동 재개');
            startBreathingCycle({ phaseIndex: currentPhaseIndex, timeLeft: currentTimeLeft });
            if (mediaRecorder && mediaRecorder.state === 'paused') {
                mediaRecorder.resume();
            }
        } else {
            isPaused = true;
            elements.pauseBtn.textContent = '계속하기';
            console.log('운동 일시정지');
            clearInterval(timer);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.pause();
            }
        }
    }

    function stopExercise() {
        isRunning = false;
        clearInterval(timer);

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        resetUI();
        console.log('녹화 중지됨');
    }

    function resetUI() {
        elements.startBtn.style.display = 'block';
        elements.pauseBtn.style.display = 'none';
        elements.stopBtn.style.display = 'none';
        elements.countDisplay.textContent = '0';
        elements.phaseName.textContent = '';
        elements.instruction.textContent = '운동을 시작하려면 "시작하기"를 누르세요.';
        currentCycle = 0;
        elements.currentCycleDisplay.textContent = '0';
    }

    elements.readyBtn.addEventListener('click', initCamera);
    elements.startBtn.addEventListener('click', startExercise);
    elements.pauseBtn.addEventListener('click', pauseExercise);
    elements.stopBtn.addEventListener('click', stopExercise);
});