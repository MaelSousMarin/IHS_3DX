beScript.onStart = function () {
    var self = this;
    this._tempsEcoule = 0;
    this._nbEnvoisInitiaux = 0;
    this._dictionnaireAnims = {};
    this._listeNomsAnims = [];
    this._animEnCours = null;
    this._nomAnimEnCours = "";

    // 1. Trouver le Visualisateur Web 2D
    var myActor = this.actor || (this.getActor ? this.getActor() : null);
    var exp = myActor ? myActor.getExperience() : null;
    var scene = (myActor && typeof myActor.getScene === "function") ? myActor.getScene() : null;

    if (myActor && typeof myActor.sendMessage === "function") {
        this._webViewer = myActor;
    } else if (exp && typeof exp.getActorByName === "function") {
        this._webViewer = exp.getActorByName("Visualisateur Web 2D") || exp.getActorByName("testweb");
    }

    // 2. Enregistrer chaque animation sans doublon
    var ajouterAnimation = function (anim) {
        if (!anim || typeof anim.getName !== "function") return;
        var nom = anim.getName();
        if (nom && !self._dictionnaireAnims[nom]) {
            self._dictionnaireAnims[nom] = anim;
            self._listeNomsAnims.push({
                name: nom,
                duration: (typeof anim.duration === "number") ? anim.duration : 0
            });
        }
    };

    // 3. Récupérer les animations de la Scène, de l'Expérience et des Acteurs
    if (scene && typeof scene.getAnimations === "function") {
        var animsScene = scene.getAnimations();
        if (animsScene) {
            for (var i = 0; i < animsScene.length; i++) {
                ajouterAnimation(animsScene[i]);
            }
        }
    }

    if (exp && typeof exp.getAnimations === "function") {
        var animsExp = exp.getAnimations();
        if (animsExp) {
            for (var j = 0; j < animsExp.length; j++) {
                ajouterAnimation(animsExp[j]);
            }
        }
    }

    var acteurs = (scene && typeof scene.getActors === "function")
        ? scene.getActors()
        : (exp && typeof exp.getActors === "function" ? exp.getActors() : []);

    if (acteurs) {
        for (var k = 0; k < acteurs.length; k++) {
            var act = acteurs[k];
            if (!this._webViewer && typeof act.sendMessage === "function") {
                this._webViewer = act;
            }
            if (act && typeof act.getAnimations === "function") {
                var animsActeur = act.getAnimations();
                for (var m = 0; m < animsActeur.length; m++) {
                    ajouterAnimation(animsActeur[m]);
                }
            }
        }
    }

    console.log("Animations détectées dans la scène : " + JSON.stringify(this._listeNomsAnims));

    // 4. Envoyer la liste des animations à la page web
    this.envoyerListeAuWeb = function () {
        if (!self._webViewer || typeof self._webViewer.sendMessage !== "function") return;
        var paquet = {
            type: "ANIMATION_LIST",
            animations: self._listeNomsAnims
        };
        self._webViewer.sendMessage(JSON.stringify(paquet));
    };

    // 5. Informer la page web de l'état Play / Stop d'une animation
    this.notifierEtatAuWeb = function (nomAnim, estEnLecture) {
        if (!self._webViewer || typeof self._webViewer.sendMessage !== "function") return;
        var paquetEtat = {
            type: "ANIMATION_STATE",
            name: nomAnim,
            playing: estEnLecture
        };
        self._webViewer.sendMessage(JSON.stringify(paquetEtat));
    };

    // 6. Trouver un objet animation par son nom
    this.trouverAnimation = function (nomAnim) {
        var anim = self._dictionnaireAnims[nomAnim];
        if (!anim && scene && typeof scene.getAnimationByName === "function") {
            anim = scene.getAnimationByName(nomAnim);
        }
        if (!anim && exp && typeof exp.getAnimationByName === "function") {
            anim = exp.getAnimationByName(nomAnim);
        }
        return anim;
    };

    // 7. Lancer une animation (et stopper la précédente si une autre tournait)
    this.lancerAnimationParNom = function (nomAnim) {
        if (!nomAnim) return;
        var anim = self.trouverAnimation(nomAnim);

        if (anim && typeof anim.play === "function") {
            // Si une autre animation était en cours, on la stoppe d'abord
            if (self._animEnCours && self._animEnCours !== anim && typeof self._animEnCours.stop === "function") {
                self._animEnCours.stop();
            }

            // Si cette animation est déjà en train de jouer, un nouveau clic la stoppe (bascule sécurité)
            if (typeof anim.isPlaying === "function" && anim.isPlaying()) {
                anim.stop();
                self._animEnCours = null;
                self._nomAnimEnCours = "";
                // console.log("Animation stoppée : " + nomAnim);
                self.notifierEtatAuWeb(nomAnim, false);
                return;
            }

            anim.play();
            self._animEnCours = anim;
            self._nomAnimEnCours = nomAnim;
            // console.log("Animation lancée : " + nomAnim);
            self.notifierEtatAuWeb(nomAnim, true);
        } else {
            // console.log("Animation introuvable : " + nomAnim);
        }
    };

    // 8. Stopper une animation par son nom
    this.stopperAnimationParNom = function (nomAnim) {
        if (!nomAnim) return;
        var anim = self.trouverAnimation(nomAnim);

        if (anim && typeof anim.stop === "function") {
            anim.stop();
            if (self._animEnCours === anim) {
                self._animEnCours = null;
                self._nomAnimEnCours = "";
            }
            console.log("Animation stoppée : " + nomAnim);
            self.notifierEtatAuWeb(nomAnim, false);
        }
    };

    // 9. Traiter le message reçu depuis la page web
    this.traiterMessageDuWeb = function (msgBrut, expediteur) {
        if (!msgBrut) return;

        if (!self._webViewer && expediteur && typeof expediteur.sendMessage === "function") {
            self._webViewer = expediteur;
        }

        if (msgBrut === "ready") {
            self.envoyerListeAuWeb();
            return;
        }

        try {
            var obj = (typeof msgBrut === "string") ? JSON.parse(msgBrut) : msgBrut;
            if (obj && obj.type === "WEB_READY") {
                self.envoyerListeAuWeb();
            } else if (obj && obj.type === "PLAY_ANIMATION" && obj.name) {
                self.lancerAnimationParNom(obj.name);
            } else if (obj && obj.type === "STOP_ANIMATION" && obj.name) {
                self.stopperAnimationParNom(obj.name);
            }
        } catch (e) {}
    };

    this.envoyerListeAuWeb();
};

// Écouteur officiel de Creative Experience
beScript.onAllUIWebMessageReceived = function (iEvent) {
    // console.log("Message reçu depuis la page web : " + iEvent.message);
    if (typeof this.traiterMessageDuWeb === "function") {
        this.traiterMessageDuWeb(iEvent.message, iEvent.sender);
    }
};

beScript.execute = function (iContext) {
    // 1. Envois initiaux pendant les 3 premières secondes
    if (this._nbEnvoisInitiaux < 3) {
        var dt = (iContext && iContext.deltaTime) ? iContext.deltaTime : 16;
        this._tempsEcoule += dt;

        if (this._tempsEcoule >= 1000) {
            this._tempsEcoule = 0;
            this._nbEnvoisInitiaux++;
            if (typeof this.envoyerListeAuWeb === "function") {
                this.envoyerListeAuWeb();
            }
        }
    }

    // 2. Détecter si l'animation en cours est arrivée à la fin toute seule
    if (this._animEnCours && typeof this._animEnCours.isPlaying === "function") {
        if (!this._animEnCours.isPlaying()) {
            var nomFini = this._nomAnimEnCours;
            this._animEnCours = null;
            this._nomAnimEnCours = "";
            // console.log("Animation terminée : " + nomFini);
            if (typeof this.notifierEtatAuWeb === "function") {
                this.notifierEtatAuWeb(nomFini, false);
            }
        }
    }
};

beScript.onStop = function () {
};
