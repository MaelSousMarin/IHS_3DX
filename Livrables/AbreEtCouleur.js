beScript.onStart = function () {
    this.pieceActive = null;
    this.etatsOrigine = [];
    this.nomMateriauSecours = "BleuCompass";
    this.materiauObj = null;

    // Références automatiques vers les 2 WebViewers
    this.webViewerArbre = null;
    this.webViewerFiche = null;

    // 1. Priorité au matériau lié via la propriété "materiauSelection"
    if (this.materiauSelection !== null && this.materiauSelection !== undefined) {
        this.materiauObj = this.materiauSelection;
    } else {
        try {
            var exp = this.actor.getExperience();
            if (exp && typeof exp.getResourcesByType === "function" && STU.Material) {
                var ressourcesMat = exp.getResourcesByType(STU.Material);
                for (var i = 0; i < ressourcesMat.length; i++) {
                    if (ressourcesMat[i].getName() === this.nomMateriauSecours) {
                        this.materiauObj = ressourcesMat[i];
                        break;
                    }
                }
            }
        } catch (eRes) {}
    }
};

// Construit la hiérarchie récursive de l'assemblage 3D (sous-ensembles + instances)
beScript.construireNoeudArbre = function (acteur) {
    if (!acteur) return null;
    var noeud = {
        nom: acteur.getName(),
        enfants: []
    };

    if (typeof acteur.getSubActors === "function") {
        var sousActeurs = acteur.getSubActors();
        for (var i = 0; i < sousActeurs.length; i++) {
            var enf = sousActeurs[i];
            if (enf && enf instanceof STU.Actor3D) {
                var sousNoeud = this.construireNoeudArbre(enf);
                if (sousNoeud) noeud.enfants.push(sousNoeud);
            }
        }
    }

    return noeud;
};

// Recherche de l'acteur dans l'assemblage puis dans toute l'expérience en secours
beScript.trouverActeur = function (nomPiece) {
    if (!nomPiece) return null;
    var nomCible = String(nomPiece).trim();

    if (this.actor.getName() === nomCible) {
        return this.actor;
    }

    if (typeof this.actor.getSubActorByName === "function") {
        var trouve = this.actor.getSubActorByName(nomCible, true);
        if (trouve) return trouve;
    }

    if (typeof this.actor.getAllSubActors === "function") {
        var sousActeurs = this.actor.getAllSubActors();
        for (var i = 0; i < sousActeurs.length; i++) {
            if (sousActeurs[i] && sousActeurs[i].getName() === nomCible) {
                return sousActeurs[i];
            }
        }
    }

    var exp = this.actor.getExperience();
    if (exp && typeof exp.getActorsByType === "function") {
        var tous3D = exp.getActorsByType(STU.Actor3D, true);
        for (var j = 0; j < tous3D.length; j++) {
            if (tous3D[j] && tous3D[j].getName() === nomCible) {
                return tous3D[j];
            }
        }
    }

    return null;
};

// Restaure le matériau d'origine de la pièce active et de ses sous-acteurs
beScript.restaurerPieceActive = function () {
    for (var i = 0; i < this.etatsOrigine.length; i++) {
        var item = this.etatsOrigine[i];
        var cible = item.acteur;
        if (!cible) continue;

        try {
            if (item.materiau !== null && item.materiau !== undefined && typeof cible.setMaterial === "function") {
                cible.setMaterial(item.materiau);
            } else if (item.nomMateriau && typeof cible.setMaterialByName === "function") {
                cible.setMaterialByName(item.nomMateriau);
            } else if (typeof cible.removeMaterials === "function") {
                cible.removeMaterials();
            }
        } catch (err) {}
    }

    this.etatsOrigine = [];
    this.pieceActive = null;
};

// Applique la surbrillance sur la pièce demandée (ou restaure tout si nomPiece est null)
beScript.appliquerSelection = function (nomPiece) {
    if (this.pieceActive && this.pieceActive.getName() === nomPiece) {
        return;
    }

    this.restaurerPieceActive();

    if (!nomPiece) return;

    var nouvelActeur = this.trouverActeur(nomPiece);
    if (!nouvelActeur) return;

    this.pieceActive = nouvelActeur;

    var cibles = [nouvelActeur];
    if (typeof nouvelActeur.getAllSubActors === "function") {
        var sousActeurs = nouvelActeur.getAllSubActors();
        if (sousActeurs && sousActeurs.length > 0) {
            cibles = cibles.concat(sousActeurs);
        }
    }

    for (var i = 0; i < cibles.length; i++) {
        var cible = cibles[i];
        if (!cible || !(cible instanceof STU.Actor3D)) continue;

        var matOrig = null;
        var nomMatOrig = "";
        try {
            if (typeof cible.getMaterial === "function") {
                matOrig = cible.getMaterial();
            }
            if (typeof cible.getMaterialName === "function") {
                nomMatOrig = cible.getMaterialName() || "";
            }
        } catch (eMat) {}

        this.etatsOrigine.push({
            acteur: cible,
            materiau: matOrig,
            nomMateriau: nomMatOrig
        });

        if (this.materiauObj !== null && typeof cible.setMaterial === "function") {
            cible.setMaterial(this.materiauObj);
        } else if (typeof cible.setMaterialByName === "function") {
            cible.setMaterialByName(this.nomMateriauSecours);
        }
    }
};

// Pont bidirectionnel entre ArbreEtAnimationM2.html et proprieteM2.html
beScript.onAllUIWebMessageReceived = function (iEvent) {
    if (!iEvent || !iEvent.message) return;

    var msg;
    try {
        msg = (typeof iEvent.message === "string")
            ? JSON.parse(iEvent.message)
            : iEvent.message;
    } catch (e) {
        return;
    }

    if (!msg || !msg.action) return;

    try {
        // 1. Initialisation du panneau gauche (ArbreEtAnimationM2.html)
        if (msg.action === "TREE_READY") {
            this.webViewerArbre = iEvent.sender;
            var arbre = this.construireNoeudArbre(this.actor);
            if (this.webViewerArbre && typeof this.webViewerArbre.sendMessage === "function") {
                this.webViewerArbre.sendMessage(JSON.stringify({
                    action: "TREE_DATA",
                    arbre: arbre
                }));
                if (this.pieceActive) {
                    this.webViewerArbre.sendMessage(JSON.stringify({
                        action: "HIGHLIGHT_TREE",
                        nomPiece: this.pieceActive.getName()
                    }));
                }
            }
            return;
        }

        // 2. Initialisation du panneau droit (proprieteM2.html)
        if (msg.action === "FICHE_READY") {
            this.webViewerFiche = iEvent.sender;
            return;
        }

        // 3. Sélection venue de proprieteM2.html (clic dans la 3D) -> Bleu + surbrillance Arbre
        if (msg.action === "SYNC_SELECTION") {
            this.webViewerFiche = iEvent.sender;
            this.appliquerSelection(msg.nomPiece || null);

            if (this.webViewerArbre && typeof this.webViewerArbre.sendMessage === "function") {
                this.webViewerArbre.sendMessage(JSON.stringify({
                    action: "HIGHLIGHT_TREE",
                    nomPiece: msg.nomPiece || null
                }));
            }
            return;
        }

        // 4. Sélection venue de ArbreEtAnimationM2.html -> Bleu + mise à jour proprieteM2.html
        if (msg.action === "SELECT_FROM_TREE") {
            this.webViewerArbre = iEvent.sender;
            this.appliquerSelection(msg.nomPiece || null);

            var ficheViewer = this.webViewerFiche;
            if (!ficheViewer) {
                var exp = this.actor.getExperience();
                if (exp && typeof exp.getActorByName === "function") {
                    ficheViewer = exp.getActorByName("testweb");
                }
            }

            if (ficheViewer && typeof ficheViewer.sendMessage === "function") {
                ficheViewer.sendMessage(msg.nomPiece ? String(msg.nomPiece) : "PRINTHEAD");
            }
        }
    } catch (errGlobal) {}
};

// Nettoyage automatique à l'arrêt du mode Play
beScript.onStop = function () {
    this.restaurerPieceActive();
};
