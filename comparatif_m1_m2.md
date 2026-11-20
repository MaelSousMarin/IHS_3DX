# Comparatif expérimental : Méthode 1 (100 % PLM) vs Méthode 2 (Passerelle CSV)

Ce document synthétise l'évaluation comparative des deux architectures développées et validées sur le cas d'étude **tête d'impression Ultimaker 2+ (26 pièces uniques)** au sein de **CATIA / Creative Experience (3DEXPERIENCE)** pour alimenter dynamiquement le Passeport Numérique (`index.html`).

---

## 1. Rappel des deux pipelines évalués

### Méthode 1 : Approche intégrée 100 % PLM (Produit Père $\rightarrow$ `getPLMMetadata()`)
* **Principe :** Maintenir une continuité numérique native sans fichier externe en injectant les propriétés physiques calculées dans CATIA (Masse, Volume, Matériau) dans le `Commentaire de révision` (`V_versionComment`) du produit père.
* **Chaîne technique :**
  1. **CATIA (Macro v8c) :** Passage en mode Édition $\rightarrow$ Détection matériaux (`MATPLMService`) et tri des pièces avec matériau $\rightarrow$ Calcul d'inertie (`InertiaService` / `smartVolume`) $\rightarrow$ Compression (`Nom|Masse|Volume|Materiau`) $\rightarrow$ Écriture PLM sur la racine + `Ctrl+S`.
  2. **Creative Experience (`beScript`) :** Lecture de `getPLMMetadata()` sur l'assemblage père $\rightarrow$ Décompression à la volée $\rightarrow$ Envoi JSON (`PLM_ASSEMBLAGE`) vers le Visualisateur Web 2D (`testweb`).
  3. **IHS Web (`index.html`) :** Mise en cache du dictionnaire PLM et affichage dynamique au clic 3D.

### Méthode 2 : Approche découplée par Passerelle CSV (CAO $\rightarrow$ CSV $\rightarrow$ Calcul Web)
* **Principe :** Séparer le flux géométrique 3D (qui n'envoie que le nom de l'acteur cliqué) du flux de données physiques, en croisant des tables CSV externes directement dans le navigateur web.
* **Chaîne technique :**
  1. **CATIA (Macro Export CSV) :** Passage en mode Édition $\rightarrow$ Calcul automatique des volumes géométriques (`smartVolume`) sur les géométries 3D nues $\rightarrow$ Export local `volumes_catia.csv` (`Piece;Volume`) sans sauvegarde ENOVIA.
  2. **Base de données externe :** `materiaux.csv` (références constructeur Ultimaker, matériaux et densités $\rho$ en $\text{kg/m}^3$) + `catalogue_ultimaker.csv` (noms officiels).
  3. **IHS Web (`index.html`) :** Fusion automatique des 3 CSV, conversion des volumes en $\text{m}^3$ et calcul dynamique de la masse en temps réel par la relation :
     $$m = \rho \times V$$

---

## 2. Tableau comparatif multicritères

| Critère d'évaluation | Méthode 1 : 100 % PLM (Produit Père) | Méthode 2 : Passerelle CSV + Calcul Web |
| :--- | :--- | :--- |
| **Nature du flux de données** | Attributs administratifs ENOVIA détournés (`V_versionComment` / `V_description`) | Tables de données structurées externes (`.csv`) découplées de la scène 3D |
| **Prérequis CAO dans CATIA** | **Élevés :** Application obligatoire des matériaux dans CATIA + droits d'écriture ENOVIA + sauvegarde (`Ctrl+S`) | **Minimaux :** Fonctionne directement sur des géométries 3D nues (imports STEP sans matériau ni inertie) |
| **Automatisation CATIA** | Macro VBScript complexe (`MATPLMService`, `InertiaService`, compression, gestion des erreurs PLM) | Macro VBScript légère (uniquement extraction des volumes géométriques via `smartVolume`) |
| **Passage à l'échelle (Scalabilité)** | **Bloqué (~8 pièces max) :** Plafond strict de **255 / 256 caractères** par champ texte dans ENOVIA | **Illimité :** Supporte des centaines ou milliers de pièces sans perte ni troncature |
| **Compatibilité d'exécution** | **Limitée :** `getPLMMetadata()` dépend de la session **Creative Experience Web** et du rafraîchissement du cache ENOVIA | **Universelle :** Fonctionne sur Client lourd (VM/PC), Web et casque VR sans dépendance à l'API ENOVIA |
| **Logique dans Creative Experience** | 2 scripts `beScript` (1 script de clic + 1 script d'extraction/décompression PLM sur l'assemblage) | 1 seul script `beScript` générique (envoi du nom de l'acteur cliqué uniquement) |
| **Maintenabilité / Mise à jour** | **Lourde :** Relancer la macro, sauvegarder dans ENOVIA (`Ctrl+S`) et recharger la scène Creative Experience | **Instantanée :** Modifier une densité dans `materiaux.csv` ou remplacer `volumes_catia.csv` sur le dépôt |
| **Propreté architecturale PLM** | **Faible :** Détournement d'un champ de gestion de révision pour stocker des grandeurs physiques | **Élevée :** Séparation propre entre maquette 3D temps réel et base de données métier (*Data-Driven*) |

---

## 3. Preuves expérimentales sur l'Ultimaker 2+ (26 pièces uniques)

Les tests réalisés sur l'assemblage réel `mael_Original ultimakerCS_SE14_buse` (26 pièces uniques issues d'un import STEP) mettent en évidence un écart net de comportement :

1. **Saturation expérimentale de la Méthode 1 :**
   * **Format standard lisible (v8) :** 26 pièces génèrent **2 948 caractères** (11,5× la limite ENOVIA) $\rightarrow$ Rejet par l'API (`Err -2147024809`).
   * **Format compressé (v9) :** 26 pièces génèrent **721 caractères** (2,8× la limite) $\rightarrow$ Rejet par l'API (`Err -2147024809`). Le test manuel par copier-coller confirme une troncature nette à **256 caractères** (en plein milieu de la 9e pièce).
   * **Contournement par filtrage matériau (v8c) :** En ne conservant que les **4 pièces** munies du matériau `PA6-GF30`, la chaîne descend sous les 255 caractères et la pipeline complète fonctionne de bout en bout. Toutefois, cette réussite confirme que la Méthode 1 ne peut couvrir qu'un sous-ensemble très restreint de pièces.

2. **Validation complète de la Méthode 2 :**
   * Les **26 pièces uniques** ont toutes vu leur volume extrait automatiquement dans `volumes_catia.csv` en une seule exécution, sans appliquer de matériau dans CATIA ni toucher à ENOVIA.
   * La fusion dans `index.html` calcule et affiche instantanément la masse ($m = \rho \times V$), le volume et le matériau officiel constructeur pour l'intégralité de l'assemblage.

---

## 4. Verdict et recommandation d'ingénieur

* **Méthode 1 (100 % PLM)** : Pertinente comme **preuve de concept (PoC)** démontrant qu'il est techniquement possible de faire transiter des propriétés physiques par ENOVIA jusqu'à Creative Experience sans fichier externe. Elle reste néanmoins **inadaptée à un déploiement industriel** tant que Creative Experience ne conserve pas les attributs physiques natifs sur les sous-acteurs et que les champs texte ENOVIA restent plafonnés à 255 caractères.
* **Méthode 2 (Passerelle CSV)** : **Solution retenue pour l'architecture finale**. Elle répond à l'ensemble des exigences du cahier des charges (robustesse, scalabilité, rapidité de mise à jour, compatibilité PC/Web/VR) tout en conservant une logique 3D minimale dans Creative Experience.