if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/breathing-exercise/service-worker.js')
            .then(() => console.log('ServiceWorker registration successful'))
            .catch(err => console.error('ServiceWorker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    let audioContext = null;
    let isRunning = false;
    let isPaused = false;
    let currentCycle = 0;
    let totalCycles = 10;
    let timer = null;
    let stream = null;
    let mediaRecorder = null;
    let animationFrameId = null;
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
        totalCyclesDisplay: document.getElementById('totalCycles'),
        difficultySelect: document.getElementById('difficultySelect'),
        settingsModal: document.getElementById('settingsModal'),
        startWithSettings: document.getElementById('startWithSettings'),
        canvas: document.getElementById('recordingCanvas'),
    };

    elements.readyBtn.style.display = 'block';  // '준비 완료' 버튼 표시
    elements.startBtn.style.display = 'none';   // '시작하기' 버튼 숨김
    elements.stopBtn.style.display = 'none';    // '정지' 버튼 숨김

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

    const difficultySettings = {
        beginner: {
            prepare: 3,
            inhale: 5,
            hold: 3,
            exhale: 5,
            holdAfterExhale: 3
        },
        intermediate: {
            prepare: 3,
            inhale: 7,
            hold: 5,
            exhale: 7,
            holdAfterExhale: 5
        },
        advanced: {
            prepare: 3,
            inhale: [5, 7],  // 범위 지정
            hold: [3, 5],
            exhale: [5, 7],
            holdAfterExhale: [3, 5]
        }
    };

    let breathingPhases = [
        { name: '준비', text: '자세를 잡고 호흡을 준비하세요.', time: 3, color: '#0e4cb0' },
        { name: '들이쉬기', text: '숨을 천천히 들이마셔 주세요.', time: 7, color: '#febe00' },
        { name: '참기', text: '숨을 잠시 멈추세요.', time: 5, color: '#ee1b24' },
        { name: '내쉬기', text: '숨을 천천히 내쉬어 주세요.', time: 7, color: '#febe00' },
        { name: '참기', text: '숨을 잠시 멈추세요.', time: 5, color: '#ee1b24' },
    ];

    async function initCamera() {
        console.log('initCamera 함수 시작');  // 디버깅용
        try {
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: true,
            };

            console.log('getUserMedia 시도');  // 디버깅용
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('getUserMedia 성공');  // 디버깅용
            elements.video.srcObject = stream;
            await elements.video.play();

            // Canvas 설정
            const canvas = elements.canvas;
            const ctx = canvas.getContext('2d');
            canvas.width = 1280;
            canvas.height = 720;

            // 캔버스 스트림 생성
            const canvasStream = canvas.captureStream(30); // 30fps

            // 오디오 트랙 추가
            stream.getAudioTracks().forEach(track => {
                canvasStream.addTrack(track);
            });

            const options = { 
                mimeType: 'video/webm; codecs=vp8',
                videoBitsPerSecond: 2500000,
            };

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`MIME 타입 ${options.mimeType}이 지원되지 않습니다. 대체 타입 사용.`);
                options.mimeType = 'video/mp4';
            }
    
            // MediaRecorder 초기화 (Canvas 스트림 사용)
            mediaRecorder = new MediaRecorder(canvasStream, options);
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                    console.log('데이터 청크 추가됨:', event.data.size);
                }
            };
    
            mediaRecorder.onstop = () => {
                setTimeout(() => {
                    if (chunks.length > 0) {
                        const blob = new Blob(chunks, { type: options.mimeType });
                        const fileName = `recorded-video-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = URL.createObjectURL(blob);
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(a.href);
                    }
                }, 500);
            };

            // 프레임 업데이트 함수
            function drawFrame() {
                if (!isRunning) {
                    cancelAnimationFrame(animationFrameId);
                    return;
                }
            
                // 비디오 프레임 그리기
                ctx.drawImage(elements.video, 0, 0, canvas.width, canvas.height);
            
                // 현재 단계와 타이머 정보 그리기
                const phase = breathingPhases[currentPhaseIndex];
                
                // 배경 박스
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(10, 10, 300, 80);
                
                // 텍스트 정보
                ctx.fillStyle = phase?.color || '#ffffff';
                ctx.font = 'bold 24px Pretendard';
                ctx.fillText(`${phase?.name || ''} (${currentTimeLeft}초)`, 20, 45);
                ctx.fillStyle = '#ffffff';
                ctx.font = '18px Pretendard';
                ctx.fillText(`사이클: ${currentCycle}/${totalCycles}`, 20, 75);
            
                animationFrameId = requestAnimationFrame(drawFrame);
            }

            // 프레임 업데이트 시작
            drawFrame();

            elements.readyBtn.style.display = 'none';
            elements.exerciseControls.style.display = 'flex';
            elements.startBtn.style.display = 'block';
            elements.pauseBtn.style.display = 'none';
            elements.stopBtn.style.display = 'block';
            elements.instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';

            console.log('Buttons visibility updated'); // 디버깅용 로그 추가
            
        } catch (err) {
            console.error('Camera initialization error:', err);
            alert('카메라 초기화 중 오류가 발생했습니다: ' + err.message);
        }
    }

    function createBeepSound() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    function updateBreathingPhases() {
        const difficulty = elements.difficultySelect.value;
        const settings = difficultySettings[difficulty];
        
        function getRandomTime(range) {
            if (Array.isArray(range)) {
                const [min, max] = range;
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
            return range;
        }
    
        return [
            { 
                name: '준비', 
                text: '자세를 잡고 호흡을 준비하세요.', 
                time: settings.prepare, 
                color: '#0e4cb0' 
            },
            { 
                name: '들이쉬기', 
                text: '숨을 천천히 들이마셔 주세요.', 
                time: getRandomTime(settings.inhale), 
                color: '#febe00' 
            },
            { 
                name: '참기', 
                text: '숨을 잠시 멈추세요.', 
                time: getRandomTime(settings.hold), 
                color: '#ee1b24' 
            },
            { 
                name: '내쉬기', 
                text: '숨을 천천히 내쉬어 주세요.', 
                time: getRandomTime(settings.exhale), 
                color: '#febe00' 
            },
            { 
                name: '참기', 
                text: '숨을 잠시 멈추세요.', 
                time: getRandomTime(settings.holdAfterExhale), 
                color: '#ee1b24' 
            }
        ];
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
            elements.countDisplay.textContent = currentTimeLeft > 0 ? currentTimeLeft : '';

            // 현재 단계의 색상 적용
            elements.phaseName.style.color = phase.color;
            elements.countDisplay.style.color = phase.color;
            elements.progress.style.backgroundColor = phase.color;
    
            // 마지막 3초 카운트다운 시 효과음 재생 (이 부분 추가)
            if (currentTimeLeft <= 3 && currentTimeLeft > 0) {
                createBeepSound();
            }

            const totalTime = breathingPhases.reduce((sum, phase) => sum + phase.time, 0);
            const elapsedTime = breathingPhases
                .slice(0, currentPhaseIndex)
                .reduce((sum, phase) => sum + phase.time, 0) +
                (breathingPhases[currentPhaseIndex].time - currentTimeLeft);
            const progressWidth = (elapsedTime / totalTime) * 100;
            elements.progress.style.width = `${progressWidth}%`;

            currentTimeLeft--;

            if (currentTimeLeft <= 0) {
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

        // AudioContext 초기화 (이 부분 추가)
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        breathingPhases = updateBreathingPhases();  // 난도에 따른 시간 설정 업데이트
        
        isRunning = true;
        isPaused = false;
        currentCycle = 0;
        elements.currentCycleDisplay.textContent = '0';
        elements.startBtn.style.display = 'none';
        elements.pauseBtn.style.display = 'block';
        elements.stopBtn.style.display = 'block';

        chunks.length = 0;  // 청크 배열 초기화 추가
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
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    
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
        elements.instruction.textContent = '호흡을 시작하려면 "시작하기"를 누르세요.';
        elements.countDisplay.style.color = '#febe00';  // 기본 색상으로 리셋
        elements.phaseName.style.color = '#febe00';     // 기본 색상으로 리셋
        elements.progress.style.backgroundColor = '#febe00'; // 기본 색상으로 리셋
        currentCycle = 0;
        elements.currentCycleDisplay.textContent = '0';
    }

    elements.readyBtn.addEventListener('click', initCamera);
    elements.startBtn.addEventListener('click', startExercise);    
    elements.pauseBtn.addEventListener('click', pauseExercise);
    elements.stopBtn.addEventListener('click', stopExercise);

    // 페이지 로드 시 모달 표시
    elements.settingsModal.style.display = 'flex';

    // 모달의 시작하기 버튼 클릭 시
    elements.startWithSettings.addEventListener('click', () => {
        console.log('준비 완료 버튼 클릭됨');  // 디버깅용
        elements.settingsModal.style.display = 'none';
        elements.readyBtn.style.display = 'block';
    });

    // 모달 외부 클릭 시 닫기
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            elements.settingsModal.style.display = 'none';
            elements.readyBtn.style.display = 'block';
        }
    });

});