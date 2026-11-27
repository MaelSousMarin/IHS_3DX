beScript.onStart = function () {
    this._compteur = 0;
    this._plmEnvoye = false;
};

beScript.onExecute = function () {
    if (this._plmEnvoye) return;
    this._compteur++;

    // Attend 120 frames (~2 secondes) que la page HTML soit chargée dans "testweb"
    if (this._compteur >= 120) {
        var webActor = this.actor.getExperience().getActorByName("testweb");

        if (webActor && typeof webActor.sendMessage === "function") {
            var meta = {};
            if (typeof this.actor.getPLMMetadata === "function") {
                meta = this.actor.getPLMMetadata() || {};
            }

            // 1. Extraction du Commentaire de révision (ou Description en secours)
            var brut = meta["Commentaire de révision"] ||
                       meta["Revision Comment"] ||
                       meta["V_versionComment"] ||
                       meta["Description"] ||
                       meta["V_description"] || "";

            // Secours : cherche n'importe quel champ contenant le séparateur "|" de la macro v8c
            if (!brut) {
                for (var cle in meta) {
                    if (meta.hasOwnProperty(cle) && typeof meta[cle] === "string" && meta[cle].indexOf("|") !== -1) {
                        brut = meta[cle];
                        break;
                    }
                }
            }

            // 2. Décompression du format compact v8c (Nom|Masse|Volume|Materiau)
            // vers le format attendu par index.html ([i] Nom | Masse : ... | Volume : ... | Materiau : ...)
            var lignes = brut ? brut.split(/\r?\n/) : [];
            var lignesDecompressees = [];
            var piecesStruct = [];

            for (var i = 0; i < lignes.length; i++) {
                var ligne = lignes[i].trim();
                if (!ligne) continue;

                // Si la ligne est déjà à l'ancien format ("Masse :"), on la garde telle quelle
                if (ligne.indexOf("Masse :") !== -1) {
                    lignesDecompressees.push(ligne);
                } else {
                    var cols = ligne.split("|");
                    if (cols.length >= 4) {
                        var nom = cols[0].trim();
                        var masse = cols[1].trim();
                        var volume = cols[2].trim();
                        var materiau = cols[3].trim();

                        if (masse === "-" || masse === "") masse = "Non calculée";
                        if (volume === "-" || volume === "") volume = "--";
                        if (materiau === "-" || materiau === "") materiau = "Standard";

                        var idx = lignesDecompressees.length + 1;
                        lignesDecompressees.push("[" + idx + "] " + nom + " | Masse : " + masse + " | Volume : " + volume + " | Materiau : " + materiau);

                        piecesStruct.push({
                            nom: nom,
                            masse: masse,
                            volume: volume,
                            materiau: materiau
                        });
                    }
                }
            }

            var commentaireFormate = lignesDecompressees.join("\n");

            var paquet = {
                type: "PLM_ASSEMBLAGE",
                nomAssemblage: this.actor.getName ? this.actor.getName() : this.actor.name,
                commentaireRevision: commentaireFormate,
                pieces: piecesStruct,
                plmBrut: meta
            };

            webActor.sendMessage(JSON.stringify(paquet));
            console.log("PLM v8c décompressé et envoyé à testweb (" + lignesDecompressees.length + " pièces) :\n" + commentaireFormate);
            this._plmEnvoye = true;
        }
    }
};

beScript.onStop = function () {
};
