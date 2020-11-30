module.exports = {
	intro: "Hey there! Wanna play chess? Y/N",
	playLater: "Okay, no problem! Text me back if you want to play later.",
	reset: "Are you sure you want to reset the game? Y/N",
	resetCancelled: "Okay! Nevermind, we'll keep playing... Enter your next move.",
	resetComplete: "Game has been reset. Please text back if you'd like to try again!",
	sorry: [
		"Sorry, I don't undrestand that response 😕 Please try again?",
		"Sorry, I don't get that 🤔... can you please try again?",
	],
	start: "OK, you're on! You start. Example, text 'd2 d4' to move your pawn up two spaces. Text 'commands' for help.",
	invalidMove: "Sorry, I don't understand this move: '{MOVE}'\n\nText 'commands' for help.",
	statusError: "Sorry, unable to retrieve game status.",
	leftOff: "Here's where we left off... \nto start over, text 'Restart'",
	difficultyError: "Sorry, error setting difficulty to {DIFFICULTY}",
	difficultyUpdated: "Difficulty level updated to {DIFFICULTY}",
	commands: `Valid commands:
    
Move - Example 'a2 a4'
Status - Show the board
Restart - Start over
Difficulty X - Set difficulty, X is from 0 (easy) to 3 (hard)`,
	yourTurn: ["Got it. I moved. Your turn!", "OK... I moved. On you.", "Your turn..."],
	checkMate: "Checkmate! Game over. Text 'Restart' to play again.",
	staleMate: "Stalemate! Game over. Text 'Stalemate' to play again.",
};
