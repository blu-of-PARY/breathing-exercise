if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/breathing-exercise/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

document.addEventListener('DOMContentLoaded', function() {
    // 전역 변수 설정
    let isRunning = false;
    let currentCycle = 0;
    let totalCycles = 10;
    let timer = null;
    let stream = null;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let isPaused = false;
    let isRecordingSupported = true;

    // 현재 상태를 저장할 변수들 추가
    let currentPhaseIndex = 0;
    let currentTimeLeft = 0;

    // 카메라 관련 변수 추가
    let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // DOM 요소들을 한 번에 정의
    const elements = {
        video: document.getElementById('webcam'),
        readyBtn: document.getElementById('readyBtn'),
        startBtn: document.getElementById('startBtn'),
        instruction: document.querySelector('.instruction-message'),
        countDisplay: document.getElementById('countNumber'),
        progress: document.querySelector('.timer-progress'),
        currentCycleDisplay: document.getElementById('currentCycle'),
        totalCyclesDisplay: document.getElementById('totalCycles'),
        cycleCountInput: document.getElementById('cycleCount'),
        phaseName: document.querySelector('.phase-name'),
        exerciseControls: document.querySelector('.exercise-controls'),
        pauseBtn: document.getElementById('pauseBtn'),
        stopBtn: document.getElementById('stopBtn')
    };

    // 각 요소가 존재하는지 확인
    Object.entries(elements).forEach(([name, element]) => {
        if (!element) {
            console.error(`${name} element not found`);
        }
    });

    // 호흡 단계 설정
    const breathingPhases = [
        { 
            name: '준비',
            text: '어깨와 허리를 펴고 호흡을 준비해 주세요.',
            time: 3 
        },
        { 
            name: '들이쉬기',
            text: '세상에 모든 공기를 내가 다 마시겠다는 생각으로 숨을 들이마셔 주세요.',
            time: 7 
        },
        { 
            name: '참기',
            text: '횡격막 쪽에 자극을 느끼며 숨을 참아 주세요.',
            time: 5 
        },
        { 
            name: '내쉬기',
            text: '몸 안에 숨이 하나도 안 남을 정도로 토해내 주세요.',
            time: 7 
        },
        { 
            name: '참기',
            text: '횡격막 쪽에 자극을 느끼며 숨을 참아 주세요.',
            time: 5 
        }
    ];

    // 카메라 초기화
    async function initCamera() {
        try {
            // 카메라 권한 요청 전에 상태 확인
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'camera' });
                console.log('Camera permission status:', result.state);
            }

            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            elements.video.srcObject = stream;
            await elements.video.play();

            elements.readyBtn.style.display = 'none';
            elements.exerciseControls.style.display = 'flex';
            elements.instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';

        } catch (err) {
            console.error('카메라 오류 상세:', err);
            
            if (err.name === 'NotAllowedError') {
                alert('카메라 사용을 허용해주세요. 설정에서 카메라 권한을 변경할 수 있습니다.');
            } else if (err.name === 'NotFoundError') {
                alert('카메라를 찾을 수 없습니다.');
            } else {
                alert('카메라를 시작할 수 없습니다. 오류: ' + err.message);
            }
        }
    }

    // 호흡 사이클 시작
    function startBreathingCycle(resumeFrom = null) {
        let phaseIndex = resumeFrom ? resumeFrom.phaseIndex : 0;
        let timeLeft = resumeFrom ? resumeFrom.timeLeft : breathingPhases[0].time;
        
        function updateTimer() {
            if (!isRunning) {
                return;
            }

            // 현재 상태 저장
            currentPhaseIndex = phaseIndex;
            currentTimeLeft = timeLeft;

            elements.phaseName.textContent = breathingPhases[phaseIndex].name;
            elements.instruction.textContent = breathingPhases[phaseIndex].text;
            elements.countDisplay.textContent = timeLeft;
            
            const totalTime = breathingPhases.reduce((sum, phase) => sum + phase.time, 0);
            const elapsedTime = breathingPhases.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.time, 0) 
                + (breathingPhases[phaseIndex].time - timeLeft);
            const progressWidth = (elapsedTime / totalTime) * 100;
            elements.progress.style.width = `${progressWidth}%`;
            
            timeLeft--;

            if (timeLeft < 0) {
                phaseIndex++;
                if (phaseIndex >= breathingPhases.length) {
                    completeCycle();
                    return;
                }
                timeLeft = breathingPhases[phaseIndex].time;
            }
        }

        if (timer) {
            clearInterval(timer);
        }
        
        updateTimer();
        timer = setInterval(updateTimer, 1000);
    }

    // 운동 시작
    function startExercise() {
        isRunning = true;
        isPaused = false;
        elements.startBtn.style.display = 'none';
        elements.pauseBtn.style.display = 'block';
        elements.pauseBtn.textContent = '일시정지';

        if (isMobile) {
            // 모바일에서는 기본 카메라 앱 실행
            try {
                // 사용자에게 안내
                alert('카메라 앱이 실행됩니다. 촬영을 시작하고 다시 이 화면으로 돌아와주세요.');
                
                // 카메라 앱 실행
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' }, 
                        audio: false 
                    }).then(function(stream) {
                        const track = stream.getVideoTracks()[0];
                        const imageCapture = new ImageCapture(track);
                        imageCapture.takePhoto().then(function() {
                            // 카메라 앱이 실행됨
                        }).catch(function(error) {
                            console.log('카메라 앱 실행 오류:', error);
                        });
                    });
                }
            } catch (e) {
                console.warn('카메라 앱 실행 실패:', e);
            }
        } else {
            // 데스크톱에서는 기존 방식대로 녹화
            if (mediaRecorder) {
                recordedChunks = [];
                mediaRecorder.start();
                isRecording = true;
            }
        }

        startBreathingCycle();
    }

    // 일시 정지
    function pauseExercise() {
        isPaused = true;
        isRunning = false;
        elements.pauseBtn.textContent = '계속하기';
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        // 현재 상태 유지
    }

    // 운동 재개
    function resumeExercise() {
        isPaused = false;
        isRunning = true;
        elements.pauseBtn.textContent = '일시정지';
        // 저장된 상태에서 재개
        startBreathingCycle({
            phaseIndex: currentPhaseIndex,
            timeLeft: currentTimeLeft
        });
    }

    // 운동 완전 정지
    function stopExercise() {
        isRunning = false;
        isPaused = false;
        
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        
        // 녹화 중지 (가능한 경우에만)
        if (isRecordingSupported && isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
            try {
                mediaRecorder.stop();
                isRecording = false;
            } catch (e) {
                console.warn('Recording failed to stop:', e);
            }
        }

        elements.startBtn.style.display = 'block';
        elements.pauseBtn.style.display = 'none';
        elements.startBtn.textContent = '시작하기';
        
        // 상태 초기화
        currentPhaseIndex = 0;
        currentTimeLeft = 0;
        
        resetUI();
    }

    // UI 초기화
    function resetUI() {
        elements.countDisplay.textContent = '0';
        elements.progress.style.width = '0%';
        elements.phaseName.textContent = '준비';
        elements.instruction.textContent = '자세를 잡고 호흡 준비를 해 주세요.';
        currentCycle = 0;
        elements.currentCycleDisplay.textContent = '0';
    }

    // 사이클 완료
    function completeCycle() {
        currentCycle++;
        elements.currentCycleDisplay.textContent = currentCycle;
        
        if (currentCycle >= totalCycles) {
            alert('모든 사이클이 완료되었습니다!');
            stopExercise();
        } else if (isRunning) {
            startBreathingCycle();
        }
    }

    // 이벤트 리스너
    elements.readyBtn.addEventListener('click', initCamera);
    
    elements.startBtn.addEventListener('click', startExercise);
    
    elements.pauseBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeExercise();
        } else {
            pauseExercise();
        }
    });
    
    elements.stopBtn.addEventListener('click', stopExercise);

    elements.cycleCountInput.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        if (newCount > 0 && newCount <= 20) {
            totalCycles = newCount;
            elements.totalCyclesDisplay.textContent = newCount;
        } else {
            alert('반복 횟수는 1~20 사이로 설정해주세요.');
            this.value = totalCycles;
        }
    });
});

