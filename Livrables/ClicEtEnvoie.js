beScript.onStart = function () {
	this.actor.addObjectListener(STU.ClickablePressEvent, this, "onPieceClicked");
};

beScript.onPieceClicked = function (iEvent) {
	var pieceCliquee = iEvent.getActor ? iEvent.getActor() : this.actor;

	if (pieceCliquee) {
		var nom_piece = pieceCliquee.getName()
		let webActor = this.actor.getExperience().getActorByName("testweb");
		webActor.sendMessage(nom_piece)
	}
};

beScript.onStop = function () {
	this.actor.removeObjectListener(STU.ClickablePressEvent, this, "onPieceClicked");
};
