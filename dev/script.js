// --- Configuration ---
const AUTO_LOAD_FILENAME = "quiz.json"; 

// --- State Variables ---
let originalQuizData = []; 
let quizData = []; 
let lectureMap = new Map(); // Stores questions grouped by lecture
let currentQuestionIndex = 0;
let score = 0;
let isAnswered = false; 
let mode = 'NORMAL'; 

// --- Timer Variables ---
let startTime = 0;
let timerInterval = null;
let timeLimitSeconds = 0;
let isOvertime = false;

// --- DOM Elements ---
const statusArea = document.getElementById('status-area');
const statusMessage = document.getElementById('status-message');
const startArea = document.getElementById('start-area');
const startFileInfo = document.getElementById('start-file-info');
const maxQuestionsSpan = document.getElementById('max-questions');
const normalStartBtn = document.getElementById('normal-start-btn');
const randomStartBtn = document.getElementById('random-start-btn');
const testStartBtn = document.getElementById('test-start-btn');       
const questionCountInput = document.getElementById('question-count-input'); 
const timeLimitInput = document.getElementById('time-limit-input');     

const quizArea = document.getElementById('quiz-area');
const questionCount = document.getElementById('question-count');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const previousButton = document.getElementById('previous-button'); 
const nextButton = document.getElementById('next-button');
const feedbackMessage = document.getElementById('feedback-message');

const testQuizArea = document.getElementById('test-quiz-area');
const testTimerDisplay = document.getElementById('test-timer-display');
const testQuestionCount = document.getElementById('test-question-count');
const testScoreDisplay = document.getElementById('test-score-display');
const testQuestionsContainer = document.getElementById('test-questions-container');
const submitTestBtn = document.getElementById('submit-test-btn');

const resultsArea = document.getElementById('results-area');
const resultTitle = document.getElementById('result-title');
const finalScore = document.getElementById('final-score');
const finalTime = document.getElementById('final-time');
const testResultDetails = document.getElementById('test-result-details'); 
const testModeStatus = document.getElementById('test-mode-status');      
const testModeDetails = document.getElementById('test-mode-details');    
const restartButton = document.getElementById('restart-button');
const reviewTestButton = document.getElementById('review-test-button');
const returnHomeButton = document.getElementById('return-home-button');

// --- New Search Elements ---
const searchModeButton = document.getElementById('search-mode-button');
const searchArea = document.getElementById('search-area');
const searchInput = document.getElementById('search-input');
const executeSearchBtn = document.getElementById('execute-search-btn');
const searchResultsArea = document.getElementById('search-results-area');
const searchValidationMessage = document.getElementById('search-validation-message');

// --- New Lecture Selection Elements ---
const lectureSelectionArea = document.getElementById('lecture-selection-area');
const lectureButtonsContainer = document.getElementById('lecture-buttons-container');
const backToStartBtn = document.getElementById('back-to-start-btn');


// --- Utility Functions ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function startTimer(limitInSeconds = 0) {
    stopTimer(); 
    startTime = Date.now();
    timeLimitSeconds = limitInSeconds;
    isOvertime = false;

    const displayElement = mode === 'TEST' ? testTimerDisplay : timerDisplay;
    
    if (timeLimitSeconds > 0) {
        displayElement.textContent = formatTime(timeLimitSeconds);
    } else {
        displayElement.textContent = '00:00:00';
    }

    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        if (timeLimitSeconds > 0) {
            const remainingSeconds = timeLimitSeconds - elapsedSeconds;

            if (remainingSeconds <= 0) {
                displayElement.textContent = "TIME'S UP! (Overtime)";
                displayElement.classList.remove('text-red-600');
                displayElement.classList.add('text-yellow-600', 'font-extrabold');
                isOvertime = true;
                
                if (mode === 'TEST') {
                     clearInterval(timerInterval);
                     handleSubmitTest(); 
                }
            } else {
                displayElement.textContent = formatTime(remainingSeconds);
                displayElement.classList.remove('text-yellow-600', 'font-extrabold');
                displayElement.classList.add('text-red-600');
            }
        } else {
            displayElement.textContent = formatTime(elapsedSeconds);
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    return formatTime(elapsedSeconds);
}

// --- Core Quiz Logic Functions ---

function loadFileAutomatically() {
    statusMessage.textContent = `Fetching file: ${AUTO_LOAD_FILENAME}...`;
    statusMessage.className = 'mt-3 text-sm text-yellow-800';
    
    // Hide all main areas
    hideAllAreas();
    statusArea.classList.remove('hidden');

    fetch(AUTO_LOAD_FILENAME)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}. Please ensure **${AUTO_LOAD_FILENAME}** is correctly uploaded.`);
            }
            return response.json(); 
        })
        .then(data => {
            handleJsonData(data);
        })
        .catch(error => {
            console.error('Error fetching/processing JSON data:', error);
            statusMessage.textContent = `❌ AUTO-LOAD ERROR: ${error.message}`;
            statusMessage.className = 'mt-3 text-sm text-red-800 font-bold';
        });
}

function handleJsonData(jsonData) {
    try {
        const parsedData = [];
        lectureMap.clear(); // Reset map
        let questionId = 1;

        if (!Array.isArray(jsonData)) {
            throw new Error("JSON file must contain a top-level array of lecture objects.");
        }

        // Iterate through lectures
        jsonData.forEach((lecture, lectureIndex) => {
            // Determine a usable lecture title
            let lectureTitle = '';
            if (lecture.title && String(lecture.title).trim().length > 0) {
                lectureTitle = String(lecture.title).trim();
            } else if (lecture.lecture !== undefined && lecture.lecture !== null) {
                const raw = String(lecture.lecture).trim();
                if (/^\d+$/.test(raw)) {
                    // numeric index in JSON -> convert to 1-based label
                    lectureTitle = `Lecture ${parseInt(raw, 10) + 1}`;
                } else if (raw.length > 0) {
                    lectureTitle = raw;
                } else {
                    lectureTitle = `Lecture ${lectureIndex + 1}`;
                }
            } else {
                lectureTitle = `Lecture ${lectureIndex + 1}`;
            }

            // Initialize array for this lecture
            if (!lectureMap.has(lectureTitle)) {
                lectureMap.set(lectureTitle, []);
            }

            if (lecture.questions && Array.isArray(lecture.questions)) {
                // Iterate through questions within the lecture
                lecture.questions.forEach(q => {
                    if (q.question && q.options && q.correct_option) {
                        const questionObj = {
                            id: questionId++, 
                            question: String(q.question).trim(), 
                            answers: q.options, 
                            correctAnswer: String(q.correct_option).trim().toUpperCase(),
                            userAnswer: null, 
                            answered: false,  
                            shuffledKeys: null 
                        };
                        parsedData.push(questionObj);
                        lectureMap.get(lectureTitle).push(questionObj);
                    } else {
                        console.warn(`[Parser Warning] Skipped question in lecture "${lectureTitle}" due to missing fields.`);
                    }
                });
            }
        });
        
        originalQuizData = parsedData; 
        quizData = parsedData; 

        if (originalQuizData.length === 0) {
            throw new Error('No valid quiz questions were parsed from the JSON file.');
        }

        statusArea.classList.add('hidden');
        startArea.classList.remove('hidden');
        searchArea.classList.add('hidden'); 
        lectureSelectionArea.classList.add('hidden');

        startFileInfo.textContent = `Ready to start ${originalQuizData.length} questions.`;

        maxQuestionsSpan.textContent = originalQuizData.length;
        questionCountInput.max = originalQuizData.length;
        
        if (originalQuizData.length > 0) {
            testStartBtn.disabled = false;
            questionCountInput.value = Math.min(30, originalQuizData.length); 
        }
        
        // Populate the lecture buttons for later use
        renderLectureButtons();

    } catch (error) {
        console.error('Error processing JSON data:', error);
        statusMessage.textContent = `❌ ERROR: Could not process file. Check JSON data format. (${error.message})`;
        statusMessage.className = 'mt-3 text-sm text-red-800';
    }
}

function renderLectureButtons() {
    lectureButtonsContainer.innerHTML = '';
    
    lectureMap.forEach((questions, title) => {
        const count = questions.length;
        if (count === 0) return;

        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 bg-white border border-blue-200 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition duration-200 group flex justify-between items-center";
        
        btn.innerHTML = `
            <span class="font-semibold text-sm md:text-base">${title}</span>
            <span class="text-xs bg-blue-100 text-blue-800 py-1 px-2 rounded-full group-hover:bg-white group-hover:text-blue-600">${count} Qs</span>
        `;
        
        // When clicked, start quiz with this specific lecture
        btn.addEventListener('click', () => startQuiz('NORMAL', title));
        
        lectureButtonsContainer.appendChild(btn);
    });
}

function showLectureSelection() {
    hideAllAreas();
    lectureSelectionArea.classList.remove('hidden');
}

function startQuiz(modeType, lectureFilter = null) {
    mode = modeType; // 'NORMAL' or 'RANDOM'
    
    if (mode === 'NORMAL' && lectureFilter) {
        // Filter for specific lecture
        const lectureQuestions = lectureMap.get(lectureFilter);
        if (!lectureQuestions) {
            console.error("Lecture not found");
            return;
        }
        quizData = JSON.parse(JSON.stringify(lectureQuestions));
    } else {
        // Random mode or fallback -> use all data
        quizData = JSON.parse(JSON.stringify(originalQuizData)); 
    }

    hideAllAreas();
    quizArea.classList.remove('hidden');
    
    if (mode === 'RANDOM') {
        shuffleArray(quizData); 
    }
    
    currentQuestionIndex = 0;
    score = 0;
    isAnswered = false; 
    
    startTimer(0);
    loadQuestion();
}

// --- Functions for Study/Random Mode (Previous/Next Logic) ---

function updateNavigationButtons() {
    previousButton.disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === quizData.length - 1) {
        if (quizData[currentQuestionIndex].answered) {
            nextButton.textContent = 'Show Results 🏆';
            nextButton.disabled = false;
            nextButton.classList.remove('bg-blue-600');
            nextButton.classList.add('bg-green-600');
        } else {
            nextButton.textContent = 'Next Question ➡️';
            nextButton.disabled = !isAnswered;
            nextButton.classList.add('bg-blue-600');
            nextButton.classList.remove('bg-green-600');
        }
    } else {
        nextButton.textContent = 'Next Question ➡️';
        nextButton.disabled = !quizData[currentQuestionIndex].answered;
        nextButton.classList.add('bg-blue-600');
        nextButton.classList.remove('bg-green-600');
    }
}

function loadQuestion() {
    hideAllAreas();
    quizArea.classList.remove('hidden');

    if (currentQuestionIndex >= quizData.length) {
        showResults(false);
        return;
    }

    const currentQuiz = quizData[currentQuestionIndex];
    
    isAnswered = currentQuiz.answered;
    
    questionText.textContent = currentQuiz.question;
    questionCount.textContent = `Question ${currentQuestionIndex + 1} / ${quizData.length}`;
    
    score = quizData.filter(q => q.answered && q.userAnswer === q.correctAnswer).length;
    scoreDisplay.textContent = `Score: ${score}`;

    answersContainer.innerHTML = ''; 
    
    let answerKeys = currentQuiz.shuffledKeys;
    
    if (!answerKeys) {
        // The keys (A, B, C, D) come from the 'answers' object now
        answerKeys = Object.keys(currentQuiz.answers);
        
        if (mode === 'RANDOM' || mode === 'TEST') {
            shuffleArray(answerKeys); 
        }
        
        currentQuiz.shuffledKeys = answerKeys; 
    }

    let correctDisplayLetter = '';

    answerKeys.forEach((originalKey, i) => {
        const answerText = currentQuiz.answers[originalKey];
        const button = document.createElement('button');
        
        const displayLetter = originalKey; 
        
        if (originalKey === currentQuiz.correctAnswer) {
             correctDisplayLetter = displayLetter; 
        }

        button.classList.add('answer-btn');
        button.textContent = `${displayLetter}. ${answerText}`;
        button.dataset.answerKey = originalKey; 
        button.addEventListener('click', handleAnswerClick);

        // Apply existing state if answered (Review Mode)
        if (currentQuiz.answered) {
            button.disabled = true;
            if (originalKey === currentQuiz.correctAnswer) {
                button.classList.add('correct');
                feedbackMessage.textContent = '✅ Review: Correct!';
                feedbackMessage.classList.add('text-green-600');
                feedbackMessage.classList.remove('text-red-500');
            } else if (originalKey === currentQuiz.userAnswer) {
                button.classList.add('incorrect');
                feedbackMessage.textContent = '❌ Review: Incorrect. The correct answer is ' + correctDisplayLetter + '.';
                feedbackMessage.classList.add('text-red-500');
                feedbackMessage.classList.remove('text-green-600');
            }
        }
        
        answersContainer.appendChild(button);
    });
    
    if (!currentQuiz.answered) {
        feedbackMessage.textContent = '';
        feedbackMessage.classList.remove('text-green-600', 'text-red-500');
    }

    updateNavigationButtons();
}

function handleAnswerClick(event) {
    if (isAnswered) return;

    const selectedButton = event.target;
    const selectedKey = selectedButton.dataset.answerKey; 
    const currentQuiz = quizData[currentQuestionIndex];
    const correctKey = currentQuiz.correctAnswer;
    const allButtons = answersContainer.querySelectorAll('.answer-btn');
    
    currentQuiz.userAnswer = selectedKey; 
    currentQuiz.answered = true;
    isAnswered = true; 
    
    let correctDisplayLetter = ''; 

    allButtons.forEach((btn) => { 
        btn.disabled = true;
        const key = btn.dataset.answerKey;
        
        if (key === correctKey) {
            btn.classList.add('correct');
            correctDisplayLetter = key; 
        } else if (key === selectedKey) {
            btn.classList.add('incorrect');
        }
    });

    if (selectedKey === correctKey) {
        feedbackMessage.textContent = '✅ Correct!';
        feedbackMessage.classList.remove('text-red-500');
        feedbackMessage.classList.add('text-green-600');
    } else {
        feedbackMessage.textContent = '❌ Incorrect. The correct answer is ' + correctDisplayLetter + '.';
        feedbackMessage.classList.remove('text-green-600');
        feedbackMessage.classList.add('text-red-500');
    }
    
    score = quizData.filter(q => q.answered && q.userAnswer === q.correctAnswer).length;
    scoreDisplay.textContent = `Score: ${score}`;
    
    updateNavigationButtons();
}

function nextQuestion() {
    if (currentQuestionIndex === quizData.length - 1) {
        if (quizData[currentQuestionIndex].answered) {
            showResults(false);
        }
    } else {
        currentQuestionIndex++;
        loadQuestion();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    }
}

// --- Functions for Test Mode ---

function startTestMode() {
    const qCount = parseInt(questionCountInput.value);
    const tLimit = parseInt(timeLimitInput.value);
    const max = originalQuizData.length;

    if (isNaN(qCount) || qCount <= 0 || qCount > max) {
        console.error(`Invalid input: Number of questions must be between 1 and ${max}.`);
        return;
    }
    if (isNaN(tLimit) || tLimit <= 0) {
        console.error('Invalid input: Time limit must be > 0 minutes.');
        return;
    }

    mode = 'TEST';
    score = 0;
    
    const shuffledData = [...originalQuizData];
    shuffleArray(shuffledData);
    quizData = shuffledData.slice(0, qCount).map(q => ({
        ...q, 
        userAnswer: null, 
        answered: false, 
        shuffledKeys: null 
    })); 
    
    hideAllAreas();
    testQuizArea.classList.remove('hidden');

    testQuestionCount.textContent = quizData.length;
    
    renderTestQuestions();
    
    startTimer(tLimit * 60); 
}

function renderTestQuestions() {
    testQuestionsContainer.innerHTML = '';
    
    quizData.forEach((q, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('question-item');
        
        const qText = document.createElement('p');
        qText.classList.add('question-text-test');
        qText.textContent = `${index + 1}. ${q.question}`;
        questionElement.appendChild(qText);
        
        const answersDiv = document.createElement('div');
        answersDiv.dataset.questionIndex = index;
        
        let answerKeys = Object.keys(q.answers);
        shuffleArray(answerKeys); 
        
        q.shuffledKeys = answerKeys;
        
        answerKeys.forEach(originalKey => { 
            const answerText = q.answers[originalKey];
            const button = document.createElement('button');

            button.classList.add('answer-btn');
            const displayLetter = originalKey; 
            
            button.textContent = `${displayLetter}. ${answerText}`;
            button.dataset.answerKey = originalKey; 
            button.dataset.qIndex = index; 
            button.addEventListener('click', handleTestAnswerClick);

            if (q.userAnswer === originalKey) {
                button.classList.add('selected');
            }

            answersDiv.appendChild(button);
        });
        
        questionElement.appendChild(answersDiv);
        testQuestionsContainer.appendChild(questionElement);
    });
}

function handleTestAnswerClick(event) {
    const selectedButton = event.target;
    const selectedKey = selectedButton.dataset.answerKey; 
    const qIndex = parseInt(selectedButton.dataset.qIndex);
    
    const answersDiv = selectedButton.closest('div'); 
    const allButtons = answersDiv.querySelectorAll('.answer-btn');
    
    allButtons.forEach(btn => {
        btn.classList.remove('selected');
    });
    
    selectedButton.classList.add('selected');

    quizData[qIndex].userAnswer = selectedKey;
}

function handleSubmitTest() {
    stopTimer(); 
    score = 0; 
    
    quizData.forEach((q, index) => {
        const userChoice = q.userAnswer;
        const correctKey = q.correctAnswer;

        if (userChoice && userChoice === correctKey) {
            score++;
        }

        const answersDiv = document.querySelector(`[data-question-index="${index}"]`);
        if (answersDiv) {
            const allButtons = answersDiv.querySelectorAll('.answer-btn');
            
            allButtons.forEach(btn => {
                const key = btn.dataset.answerKey; 
                
                btn.disabled = true;

                if (key === correctKey) {
                    btn.classList.add('correct');
                    btn.classList.remove('selected');
                } else if (key === userChoice) {
                    btn.classList.add('incorrect');
                    btn.classList.remove('selected');
                }
            });
        }
    });

    showResults(true);
    
    submitTestBtn.classList.add('hidden');
}

// --- Result and Restart Functions ---

function showResults(isTestMode) {
    const finalTimeString = stopTimer(); 
    
    hideAllAreas();
    resultsArea.classList.remove('hidden');
    
    const totalQuestions = quizData.length;
    finalScore.textContent = `You scored ${score} out of ${totalQuestions}!`;
    finalTime.textContent = `Time taken: ${finalTimeString}`;

    if (isTestMode) {
        const passThreshold = Math.ceil(totalQuestions * 0.5); 
        const isPassed = score >= passThreshold && !isOvertime;
        const percentage = ((score / totalQuestions) * 100).toFixed(1);

        testResultDetails.classList.remove('hidden');
        resultTitle.textContent = 'Test Results';
        
        if (isPassed) {
            testModeStatus.textContent = '🎉 TEST PASSED! 🎉';
            testModeStatus.className = 'text-3xl font-extrabold mb-4 text-green-700';
        } else {
            testModeStatus.textContent = '❌ TEST FAILED ❌';
            testModeStatus.className = 'text-3xl font-extrabold mb-4 text-red-700';
        }

        let detailsText = `You needed ${passThreshold} correct answers (50%) to pass. You got ${score} (${percentage}%).`;
        if (isOvertime) {
            detailsText += ` You **FAILED** due to **Time Overflow** (Limit was ${formatTime(timeLimitSeconds)}).`;
        } else if (score < passThreshold) {
            detailsText += ` You **FAILED** due to **Insufficient Score**.`;
        } else {
            detailsText += ` You finished within the time limit.`;
        }
        
        testModeDetails.innerHTML = detailsText;
        reviewTestButton.classList.remove('hidden'); 

    } else {
        resultTitle.textContent = 'Quiz Complete!';
        testResultDetails.classList.add('hidden');
        reviewTestButton.classList.add('hidden');
    }
}

function reviewTestAnswers() {
    hideAllAreas();
    testQuizArea.classList.remove('hidden');
    
    document.querySelectorAll('#test-questions-container .answer-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    submitTestBtn.classList.add('hidden');
}

function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    isAnswered = false;
    startTime = 0;
    mode = 'NORMAL';
    stopTimer(); 
    
    submitTestBtn.classList.remove('hidden'); 

    loadFileAutomatically(); 
}

function hideAllAreas() {
    quizArea.classList.add('hidden');
    testQuizArea.classList.add('hidden');
    resultsArea.classList.add('hidden');
    startArea.classList.add('hidden'); 
    searchArea.classList.add('hidden'); 
    lectureSelectionArea.classList.add('hidden');
}

// --- Search Functions ---

function toggleSearchMode() {
    if (searchArea.classList.contains('hidden')) {
        // Entering search mode
        hideAllAreas();
        searchArea.classList.remove('hidden');
        searchResultsArea.classList.add('hidden');
        searchValidationMessage.classList.add('hidden');
        searchInput.value = '';
        searchInput.focus();
    } else {
        // Exiting search mode
        searchArea.classList.add('hidden');
        startArea.classList.remove('hidden'); // Return to the start screen
    }
}

function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    const queryWords = query.split(/\s+/).filter(word => word.length > 0); 

    if (queryWords.length < 3) {
        searchValidationMessage.textContent = 'Please enter a minimum of 3 words to perform a search.';
        searchValidationMessage.classList.remove('hidden');
        searchResultsArea.classList.add('hidden');
        return;
    }
    
    searchValidationMessage.classList.add('hidden');
    
    const searchResults = originalQuizData.map(q => {
        let score = 0;
        const questionTextLower = q.question.toLowerCase();
        
        queryWords.forEach(word => {
            if (questionTextLower.includes(word)) {
                score += 1;
            }
        });
        
        return {
            question: q.question,
            correctAnswer: q.answers[q.correctAnswer], 
            score: score
        };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); 

    displaySearchResults(searchResults);
}

function displaySearchResults(results) {
    searchResultsArea.classList.remove('hidden');
    searchResultsArea.innerHTML = '<h3 class="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Closest Results:</h3>';

    if (results.length === 0) {
        searchResultsArea.innerHTML += '<p class="text-gray-600">No questions matched your search terms.</p>';
        return;
    }

    results.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.classList.add('mb-4', 'p-3', 'bg-white', 'rounded-lg', 'border');
        
        resultDiv.innerHTML = `
            <p class="font-bold text-base text-gray-800 mb-1">Q${index + 1}. ${result.question}</p>
            <p class="text-lg font-semibold text-green-700">A: ${result.correctAnswer}</p>
        `;
        searchResultsArea.appendChild(resultDiv);
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadFileAutomatically); 

previousButton.addEventListener('click', previousQuestion); 
nextButton.addEventListener('click', nextQuestion);
restartButton.addEventListener('click', restartQuiz);
returnHomeButton.addEventListener('click', restartQuiz);

// Changed: Normal start button now shows lecture selection
normalStartBtn.addEventListener('click', showLectureSelection); 
randomStartBtn.addEventListener('click', () => startQuiz('RANDOM'));  
testStartBtn.addEventListener('click', startTestMode); 
submitTestBtn.addEventListener('click', handleSubmitTest);
reviewTestButton.addEventListener('click', reviewTestAnswers);

// Search Listeners
searchModeButton.addEventListener('click', toggleSearchMode);
executeSearchBtn.addEventListener('click', performSearch);

// Lecture Selection Listeners
backToStartBtn.addEventListener('click', () => {
    hideAllAreas();
    startArea.classList.remove('hidden');
});// filepath: /home/quy-linux/web/ai_iot/dev/script.js
// --- Configuration ---
const AUTO_LOAD_FILENAME = "quiz.json"; 

// --- State Variables ---
let originalQuizData = []; 
let quizData = []; 
let lectureMap = new Map(); // Stores questions grouped by lecture
let currentQuestionIndex = 0;
let score = 0;
let isAnswered = false; 
let mode = 'NORMAL'; 

// --- Timer Variables ---
let startTime = 0;
let timerInterval = null;
let timeLimitSeconds = 0;
let isOvertime = false;

// --- DOM Elements ---
const statusArea = document.getElementById('status-area');
const statusMessage = document.getElementById('status-message');
const startArea = document.getElementById('start-area');
const startFileInfo = document.getElementById('start-file-info');
const maxQuestionsSpan = document.getElementById('max-questions');
const normalStartBtn = document.getElementById('normal-start-btn');
const randomStartBtn = document.getElementById('random-start-btn');
const testStartBtn = document.getElementById('test-start-btn');       
const questionCountInput = document.getElementById('question-count-input'); 
const timeLimitInput = document.getElementById('time-limit-input');     

const quizArea = document.getElementById('quiz-area');
const questionCount = document.getElementById('question-count');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const previousButton = document.getElementById('previous-button'); 
const nextButton = document.getElementById('next-button');
const feedbackMessage = document.getElementById('feedback-message');

const testQuizArea = document.getElementById('test-quiz-area');
const testTimerDisplay = document.getElementById('test-timer-display');
const testQuestionCount = document.getElementById('test-question-count');
const testScoreDisplay = document.getElementById('test-score-display');
const testQuestionsContainer = document.getElementById('test-questions-container');
const submitTestBtn = document.getElementById('submit-test-btn');

const resultsArea = document.getElementById('results-area');
const resultTitle = document.getElementById('result-title');
const finalScore = document.getElementById('final-score');
const finalTime = document.getElementById('final-time');
const testResultDetails = document.getElementById('test-result-details'); 
const testModeStatus = document.getElementById('test-mode-status');      
const testModeDetails = document.getElementById('test-mode-details');    
const restartButton = document.getElementById('restart-button');
const reviewTestButton = document.getElementById('review-test-button');
const returnHomeButton = document.getElementById('return-home-button');

// --- New Search Elements ---
const searchModeButton = document.getElementById('search-mode-button');
const searchArea = document.getElementById('search-area');
const searchInput = document.getElementById('search-input');
const executeSearchBtn = document.getElementById('execute-search-btn');
const searchResultsArea = document.getElementById('search-results-area');
const searchValidationMessage = document.getElementById('search-validation-message');

// --- New Lecture Selection Elements ---
const lectureSelectionArea = document.getElementById('lecture-selection-area');
const lectureButtonsContainer = document.getElementById('lecture-buttons-container');
const backToStartBtn = document.getElementById('back-to-start-btn');


// --- Utility Functions ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function startTimer(limitInSeconds = 0) {
    stopTimer(); 
    startTime = Date.now();
    timeLimitSeconds = limitInSeconds;
    isOvertime = false;

    const displayElement = mode === 'TEST' ? testTimerDisplay : timerDisplay;
    
    if (timeLimitSeconds > 0) {
        displayElement.textContent = formatTime(timeLimitSeconds);
    } else {
        displayElement.textContent = '00:00:00';
    }

    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        if (timeLimitSeconds > 0) {
            const remainingSeconds = timeLimitSeconds - elapsedSeconds;

            if (remainingSeconds <= 0) {
                displayElement.textContent = "TIME'S UP! (Overtime)";
                displayElement.classList.remove('text-red-600');
                displayElement.classList.add('text-yellow-600', 'font-extrabold');
                isOvertime = true;
                
                if (mode === 'TEST') {
                     clearInterval(timerInterval);
                     handleSubmitTest(); 
                }
            } else {
                displayElement.textContent = formatTime(remainingSeconds);
                displayElement.classList.remove('text-yellow-600', 'font-extrabold');
                displayElement.classList.add('text-red-600');
            }
        } else {
            displayElement.textContent = formatTime(elapsedSeconds);
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    return formatTime(elapsedSeconds);
}

// --- Core Quiz Logic Functions ---

function loadFileAutomatically() {
    statusMessage.textContent = `Fetching file: ${AUTO_LOAD_FILENAME}...`;
    statusMessage.className = 'mt-3 text-sm text-yellow-800';
    
    // Hide all main areas
    hideAllAreas();
    statusArea.classList.remove('hidden');

    fetch(AUTO_LOAD_FILENAME)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}. Please ensure **${AUTO_LOAD_FILENAME}** is correctly uploaded.`);
            }
            return response.json(); 
        })
        .then(data => {
            handleJsonData(data);
        })
        .catch(error => {
            console.error('Error fetching/processing JSON data:', error);
            statusMessage.textContent = `❌ AUTO-LOAD ERROR: ${error.message}`;
            statusMessage.className = 'mt-3 text-sm text-red-800 font-bold';
        });
}

function handleJsonData(jsonData) {
    try {
        const parsedData = [];
        lectureMap.clear(); // Reset map
        let questionId = 1;

        if (!Array.isArray(jsonData)) {
            throw new Error("JSON file must contain a top-level array of lecture objects.");
        }

        // Iterate through lectures
        jsonData.forEach((lecture, lectureIndex) => {
            // Determine a usable lecture title
            let lectureTitle = '';
            if (lecture.title && String(lecture.title).trim().length > 0) {
                lectureTitle = String(lecture.title).trim();
            } else if (lecture.lecture !== undefined && lecture.lecture !== null) {
                const raw = String(lecture.lecture).trim();
                if (/^\d+$/.test(raw)) {
                    // numeric index in JSON -> convert to 1-based label
                    lectureTitle = `Lecture ${parseInt(raw, 10) + 1}`;
                } else if (raw.length > 0) {
                    lectureTitle = raw;
                } else {
                    lectureTitle = `Lecture ${lectureIndex + 1}`;
                }
            } else {
                lectureTitle = `Lecture ${lectureIndex + 1}`;
            }

            // Initialize array for this lecture
            if (!lectureMap.has(lectureTitle)) {
                lectureMap.set(lectureTitle, []);
            }

            if (lecture.questions && Array.isArray(lecture.questions)) {
                // Iterate through questions within the lecture
                lecture.questions.forEach(q => {
                    if (q.question && q.options && q.correct_option) {
                        const questionObj = {
                            id: questionId++, 
                            question: String(q.question).trim(), 
                            answers: q.options, 
                            correctAnswer: String(q.correct_option).trim().toUpperCase(),
                            userAnswer: null, 
                            answered: false,  
                            shuffledKeys: null 
                        };
                        parsedData.push(questionObj);
                        lectureMap.get(lectureTitle).push(questionObj);
                    } else {
                        console.warn(`[Parser Warning] Skipped question in lecture "${lectureTitle}" due to missing fields.`);
                    }
                });
            }
        });
        
        originalQuizData = parsedData; 
        quizData = parsedData; 

        if (originalQuizData.length === 0) {
            throw new Error('No valid quiz questions were parsed from the JSON file.');
        }

        statusArea.classList.add('hidden');
        startArea.classList.remove('hidden');
        searchArea.classList.add('hidden'); 
        lectureSelectionArea.classList.add('hidden');

        startFileInfo.textContent = `Ready to start ${originalQuizData.length} questions.`;

        maxQuestionsSpan.textContent = originalQuizData.length;
        questionCountInput.max = originalQuizData.length;
        
        if (originalQuizData.length > 0) {
            testStartBtn.disabled = false;
            questionCountInput.value = Math.min(30, originalQuizData.length); 
        }
        
        // Populate the lecture buttons for later use
        renderLectureButtons();

    } catch (error) {
        console.error('Error processing JSON data:', error);
        statusMessage.textContent = `❌ ERROR: Could not process file. Check JSON data format. (${error.message})`;
        statusMessage.className = 'mt-3 text-sm text-red-800';
    }
}

function renderLectureButtons() {
    lectureButtonsContainer.innerHTML = '';
    
    lectureMap.forEach((questions, title) => {
        const count = questions.length;
        if (count === 0) return;

        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 bg-white border border-blue-200 rounded-lg shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition duration-200 group flex justify-between items-center";
        
        btn.innerHTML = `
            <span class="font-semibold text-sm md:text-base">${title}</span>
            <span class="text-xs bg-blue-100 text-blue-800 py-1 px-2 rounded-full group-hover:bg-white group-hover:text-blue-600">${count} Qs</span>
        `;
        
        // When clicked, start quiz with this specific lecture
        btn.addEventListener('click', () => startQuiz('NORMAL', title));
        
        lectureButtonsContainer.appendChild(btn);
    });
}

function showLectureSelection() {
    hideAllAreas();
    lectureSelectionArea.classList.remove('hidden');
}

function startQuiz(modeType, lectureFilter = null) {
    mode = modeType; // 'NORMAL' or 'RANDOM'
    
    if (mode === 'NORMAL' && lectureFilter) {
        // Filter for specific lecture
        const lectureQuestions = lectureMap.get(lectureFilter);
        if (!lectureQuestions) {
            console.error("Lecture not found");
            return;
        }
        quizData = JSON.parse(JSON.stringify(lectureQuestions));
    } else {
        // Random mode or fallback -> use all data
        quizData = JSON.parse(JSON.stringify(originalQuizData)); 
    }

    hideAllAreas();
    quizArea.classList.remove('hidden');
    
    if (mode === 'RANDOM') {
        shuffleArray(quizData); 
    }
    
    currentQuestionIndex = 0;
    score = 0;
    isAnswered = false; 
    
    startTimer(0);
    loadQuestion();
}

// --- Functions for Study/Random Mode (Previous/Next Logic) ---

function updateNavigationButtons() {
    previousButton.disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === quizData.length - 1) {
        if (quizData[currentQuestionIndex].answered) {
            nextButton.textContent = 'Show Results 🏆';
            nextButton.disabled = false;
            nextButton.classList.remove('bg-blue-600');
            nextButton.classList.add('bg-green-600');
        } else {
            nextButton.textContent = 'Next Question ➡️';
            nextButton.disabled = !isAnswered;
            nextButton.classList.add('bg-blue-600');
            nextButton.classList.remove('bg-green-600');
        }
    } else {
        nextButton.textContent = 'Next Question ➡️';
        nextButton.disabled = !quizData[currentQuestionIndex].answered;
        nextButton.classList.add('bg-blue-600');
        nextButton.classList.remove('bg-green-600');
    }
}

function loadQuestion() {
    hideAllAreas();
    quizArea.classList.remove('hidden');

    if (currentQuestionIndex >= quizData.length) {
        showResults(false);
        return;
    }

    const currentQuiz = quizData[currentQuestionIndex];
    
    isAnswered = currentQuiz.answered;
    
    questionText.textContent = currentQuiz.question;
    questionCount.textContent = `Question ${currentQuestionIndex + 1} / ${quizData.length}`;
    
    score = quizData.filter(q => q.answered && q.userAnswer === q.correctAnswer).length;
    scoreDisplay.textContent = `Score: ${score}`;

    answersContainer.innerHTML = ''; 
    
    let answerKeys = currentQuiz.shuffledKeys;
    
    if (!answerKeys) {
        // The keys (A, B, C, D) come from the 'answers' object now
        answerKeys = Object.keys(currentQuiz.answers);
        
        if (mode === 'RANDOM' || mode === 'TEST') {
            shuffleArray(answerKeys); 
        }
        
        currentQuiz.shuffledKeys = answerKeys; 
    }

    let correctDisplayLetter = '';

    answerKeys.forEach((originalKey, i) => {
        const answerText = currentQuiz.answers[originalKey];
        const button = document.createElement('button');
        
        const displayLetter = originalKey; 
        
        if (originalKey === currentQuiz.correctAnswer) {
             correctDisplayLetter = displayLetter; 
        }

        button.classList.add('answer-btn');
        button.textContent = `${displayLetter}. ${answerText}`;
        button.dataset.answerKey = originalKey; 
        button.addEventListener('click', handleAnswerClick);

        // Apply existing state if answered (Review Mode)
        if (currentQuiz.answered) {
            button.disabled = true;
            if (originalKey === currentQuiz.correctAnswer) {
                button.classList.add('correct');
                feedbackMessage.textContent = '✅ Review: Correct!';
                feedbackMessage.classList.add('text-green-600');
                feedbackMessage.classList.remove('text-red-500');
            } else if (originalKey === currentQuiz.userAnswer) {
                button.classList.add('incorrect');
                feedbackMessage.textContent = '❌ Review: Incorrect. The correct answer is ' + correctDisplayLetter + '.';
                feedbackMessage.classList.add('text-red-500');
                feedbackMessage.classList.remove('text-green-600');
            }
        }
        
        answersContainer.appendChild(button);
    });
    
    if (!currentQuiz.answered) {
        feedbackMessage.textContent = '';
        feedbackMessage.classList.remove('text-green-600', 'text-red-500');
    }

    updateNavigationButtons();
}

function handleAnswerClick(event) {
    if (isAnswered) return;

    const selectedButton = event.target;
    const selectedKey = selectedButton.dataset.answerKey; 
    const currentQuiz = quizData[currentQuestionIndex];
    const correctKey = currentQuiz.correctAnswer;
    const allButtons = answersContainer.querySelectorAll('.answer-btn');
    
    currentQuiz.userAnswer = selectedKey; 
    currentQuiz.answered = true;
    isAnswered = true; 
    
    let correctDisplayLetter = ''; 

    allButtons.forEach((btn) => { 
        btn.disabled = true;
        const key = btn.dataset.answerKey;
        
        if (key === correctKey) {
            btn.classList.add('correct');
            correctDisplayLetter = key; 
        } else if (key === selectedKey) {
            btn.classList.add('incorrect');
        }
    });

    if (selectedKey === correctKey) {
        feedbackMessage.textContent = '✅ Correct!';
        feedbackMessage.classList.remove('text-red-500');
        feedbackMessage.classList.add('text-green-600');
    } else {
        feedbackMessage.textContent = '❌ Incorrect. The correct answer is ' + correctDisplayLetter + '.';
        feedbackMessage.classList.remove('text-green-600');
        feedbackMessage.classList.add('text-red-500');
    }
    
    score = quizData.filter(q => q.answered && q.userAnswer === q.correctAnswer).length;
    scoreDisplay.textContent = `Score: ${score}`;
    
    updateNavigationButtons();
}

function nextQuestion() {
    if (currentQuestionIndex === quizData.length - 1) {
        if (quizData[currentQuestionIndex].answered) {
            showResults(false);
        }
    } else {
        currentQuestionIndex++;
        loadQuestion();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    }
}

// --- Functions for Test Mode ---

function startTestMode() {
    const qCount = parseInt(questionCountInput.value);
    const tLimit = parseInt(timeLimitInput.value);
    const max = originalQuizData.length;

    if (isNaN(qCount) || qCount <= 0 || qCount > max) {
        console.error(`Invalid input: Number of questions must be between 1 and ${max}.`);
        return;
    }
    if (isNaN(tLimit) || tLimit <= 0) {
        console.error('Invalid input: Time limit must be > 0 minutes.');
        return;
    }

    mode = 'TEST';
    score = 0;
    
    const shuffledData = [...originalQuizData];
    shuffleArray(shuffledData);
    quizData = shuffledData.slice(0, qCount).map(q => ({
        ...q, 
        userAnswer: null, 
        answered: false, 
        shuffledKeys: null 
    })); 
    
    hideAllAreas();
    testQuizArea.classList.remove('hidden');

    testQuestionCount.textContent = quizData.length;
    
    renderTestQuestions();
    
    startTimer(tLimit * 60); 
}

function renderTestQuestions() {
    testQuestionsContainer.innerHTML = '';
    
    quizData.forEach((q, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('question-item');
        
        const qText = document.createElement('p');
        qText.classList.add('question-text-test');
        qText.textContent = `${index + 1}. ${q.question}`;
        questionElement.appendChild(qText);
        
        const answersDiv = document.createElement('div');
        answersDiv.dataset.questionIndex = index;
        
        let answerKeys = Object.keys(q.answers);
        shuffleArray(answerKeys); 
        
        q.shuffledKeys = answerKeys;
        
        answerKeys.forEach(originalKey => { 
            const answerText = q.answers[originalKey];
            const button = document.createElement('button');

            button.classList.add('answer-btn');
            const displayLetter = originalKey; 
            
            button.textContent = `${displayLetter}. ${answerText}`;
            button.dataset.answerKey = originalKey; 
            button.dataset.qIndex = index; 
            button.addEventListener('click', handleTestAnswerClick);

            if (q.userAnswer === originalKey) {
                button.classList.add('selected');
            }

            answersDiv.appendChild(button);
        });
        
        questionElement.appendChild(answersDiv);
        testQuestionsContainer.appendChild(questionElement);
    });
}

function handleTestAnswerClick(event) {
    const selectedButton = event.target;
    const selectedKey = selectedButton.dataset.answerKey; 
    const qIndex = parseInt(selectedButton.dataset.qIndex);
    
    const answersDiv = selectedButton.closest('div'); 
    const allButtons = answersDiv.querySelectorAll('.answer-btn');
    
    allButtons.forEach(btn => {
        btn.classList.remove('selected');
    });
    
    selectedButton.classList.add('selected');

    quizData[qIndex].userAnswer = selectedKey;
}

function handleSubmitTest() {
    stopTimer(); 
    score = 0; 
    
    quizData.forEach((q, index) => {
        const userChoice = q.userAnswer;
        const correctKey = q.correctAnswer;

        if (userChoice && userChoice === correctKey) {
            score++;
        }

        const answersDiv = document.querySelector(`[data-question-index="${index}"]`);
        if (answersDiv) {
            const allButtons = answersDiv.querySelectorAll('.answer-btn');
            
            allButtons.forEach(btn => {
                const key = btn.dataset.answerKey; 
                
                btn.disabled = true;

                if (key === correctKey) {
                    btn.classList.add('correct');
                    btn.classList.remove('selected');
                } else if (key === userChoice) {
                    btn.classList.add('incorrect');
                    btn.classList.remove('selected');
                }
            });
        }
    });

    showResults(true);
    
    submitTestBtn.classList.add('hidden');
}

// --- Result and Restart Functions ---

function showResults(isTestMode) {
    const finalTimeString = stopTimer(); 
    
    hideAllAreas();
    resultsArea.classList.remove('hidden');
    
    const totalQuestions = quizData.length;
    finalScore.textContent = `You scored ${score} out of ${totalQuestions}!`;
    finalTime.textContent = `Time taken: ${finalTimeString}`;

    if (isTestMode) {
        const passThreshold = Math.ceil(totalQuestions * 0.5); 
        const isPassed = score >= passThreshold && !isOvertime;
        const percentage = ((score / totalQuestions) * 100).toFixed(1);

        testResultDetails.classList.remove('hidden');
        resultTitle.textContent = 'Test Results';
        
        if (isPassed) {
            testModeStatus.textContent = '🎉 TEST PASSED! 🎉';
            testModeStatus.className = 'text-3xl font-extrabold mb-4 text-green-700';
        } else {
            testModeStatus.textContent = '❌ TEST FAILED ❌';
            testModeStatus.className = 'text-3xl font-extrabold mb-4 text-red-700';
        }

        let detailsText = `You needed ${passThreshold} correct answers (50%) to pass. You got ${score} (${percentage}%).`;
        if (isOvertime) {
            detailsText += ` You **FAILED** due to **Time Overflow** (Limit was ${formatTime(timeLimitSeconds)}).`;
        } else if (score < passThreshold) {
            detailsText += ` You **FAILED** due to **Insufficient Score**.`;
        } else {
            detailsText += ` You finished within the time limit.`;
        }
        
        testModeDetails.innerHTML = detailsText;
        reviewTestButton.classList.remove('hidden'); 

    } else {
        resultTitle.textContent = 'Quiz Complete!';
        testResultDetails.classList.add('hidden');
        reviewTestButton.classList.add('hidden');
    }
}

function reviewTestAnswers() {
    hideAllAreas();
    testQuizArea.classList.remove('hidden');
    
    document.querySelectorAll('#test-questions-container .answer-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    submitTestBtn.classList.add('hidden');
}

function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    isAnswered = false;
    startTime = 0;
    mode = 'NORMAL';
    stopTimer(); 
    
    submitTestBtn.classList.remove('hidden'); 

    loadFileAutomatically(); 
}

function hideAllAreas() {
    quizArea.classList.add('hidden');
    testQuizArea.classList.add('hidden');
    resultsArea.classList.add('hidden');
    startArea.classList.add('hidden'); 
    searchArea.classList.add('hidden'); 
    lectureSelectionArea.classList.add('hidden');
}

// --- Search Functions ---

function toggleSearchMode() {
    if (searchArea.classList.contains('hidden')) {
        // Entering search mode
        hideAllAreas();
        searchArea.classList.remove('hidden');
        searchResultsArea.classList.add('hidden');
        searchValidationMessage.classList.add('hidden');
        searchInput.value = '';
        searchInput.focus();
    } else {
        // Exiting search mode
        searchArea.classList.add('hidden');
        startArea.classList.remove('hidden'); // Return to the start screen
    }
}

function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    const queryWords = query.split(/\s+/).filter(word => word.length > 0); 

    if (queryWords.length < 3) {
        searchValidationMessage.textContent = 'Please enter a minimum of 3 words to perform a search.';
        searchValidationMessage.classList.remove('hidden');
        searchResultsArea.classList.add('hidden');
        return;
    }
    
    searchValidationMessage.classList.add('hidden');
    
    const searchResults = originalQuizData.map(q => {
        let score = 0;
        const questionTextLower = q.question.toLowerCase();
        
        queryWords.forEach(word => {
            if (questionTextLower.includes(word)) {
                score += 1;
            }
        });
        
        return {
            question: q.question,
            correctAnswer: q.answers[q.correctAnswer], 
            score: score
        };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); 

    displaySearchResults(searchResults);
}

function displaySearchResults(results) {
    searchResultsArea.classList.remove('hidden');
    searchResultsArea.innerHTML = '<h3 class="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Closest Results:</h3>';

    if (results.length === 0) {
        searchResultsArea.innerHTML += '<p class="text-gray-600">No questions matched your search terms.</p>';
        return;
    }

    results.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.classList.add('mb-4', 'p-3', 'bg-white', 'rounded-lg', 'border');
        
        resultDiv.innerHTML = `
            <p class="font-bold text-base text-gray-800 mb-1">Q${index + 1}. ${result.question}</p>
            <p class="text-lg font-semibold text-green-700">A: ${result.correctAnswer}</p>
        `;
        searchResultsArea.appendChild(resultDiv);
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadFileAutomatically); 

previousButton.addEventListener('click', previousQuestion); 
nextButton.addEventListener('click', nextQuestion);
restartButton.addEventListener('click', restartQuiz);
returnHomeButton.addEventListener('click', restartQuiz);

// Changed: Normal start button now shows lecture selection
normalStartBtn.addEventListener('click', showLectureSelection); 
randomStartBtn.addEventListener('click', () => startQuiz('RANDOM'));  
testStartBtn.addEventListener('click', startTestMode); 
submitTestBtn.addEventListener('click', handleSubmitTest);
reviewTestButton.addEventListener('click', reviewTestAnswers);

// Search Listeners
searchModeButton.addEventListener('click', toggleSearchMode);
executeSearchBtn.addEventListener('click', performSearch);

// Lecture Selection Listeners
backToStartBtn.addEventListener('click', () => {
    hideAllAreas();
    startArea.classList.remove('hidden');
});