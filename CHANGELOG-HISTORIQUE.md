# Historique des notices Atelier

## Livraison 56.6.4

- Ajout de « Mes brouillons » pour les copies locales, préparations IA locales et jobs IA accessibles sur le serveur. Les corrections IA locales restent sur leur appareil.
- Protection des données locales illisibles ; catalogue IA serveur réservé au compte et à l’espace autorisés.
- Le nettoyage automatique des photos après suppression d’un rapport reste à concevoir et n’est pas modifié dans cette livraison.

Cette archive rassemble les anciennes notices livrées avec les sources v56.6.2. Les textes ci-dessous décrivent des versions historiques et peuvent être périmés, notamment leurs règles Firebase et leurs instructions de déploiement. Ne pas les appliquer sans vérification ; se référer aux règles actuelles et au guide de déploiement de la livraison. Les guides de configuration et la licence tierce restent dans leurs fichiers séparés.

## CORRECTIF-53.3-BUILD-2.txt

~~~~~text
CORRECTIF 53.3 — BUILD 2

Le format français est désormais verrouillé dans les deux formulaires :
2 lettres, puis 3 chiffres, puis 2 lettres ; tirets automatiques.
Les caractères incompatibles et ceux au-delà de la longueur autorisée sont rejetés,
y compris lors d’un collage. Exemple : AB-123-CDEFGH devient AB-123-CD.
La case Autre format permet toujours une saisie libre.

Déployer TOUS les fichiers applicatifs du ZIP sur l’installation existante.
Ce ZIP remplace le précédent ZIP v53.3 et inclut la mise à jour depuis v53.2.
Le cache passe en outils-atelier-v53.3-r2 et les URL du correctif en build=2.
Recharger en ligne puis fermer et rouvrir l’application si nécessaire.
Aucun changement serveur IA/Firebase.
~~~~~

## LISEZ-MOI-52.3.1.txt

~~~~~text
WHEELERBROTHERS ATELIER 52.3.1 — CORRECTIF IMAGES A4
Base : archive Atelier v52.3 fournie. WB Carnet autonome non modifié.

DIAGNOSTIC DU RAPPORT FR-709-WZ
Contrôle du 10 octobre 2026, lecture seule des liens présents dans le JSON :
- 69 objets Storage : HTTP 200, images décodées intégralement.
- Logo intégré : PNG décodé, 900 x 379 pixels.
- Facture 1 : VITO ABBAS facture autodoc.pdf
  Position invoices[0].src ; identifiant s18.
  Fichier invoices-s18-1791454538426.jpg
- Facture 2 : VITO ABBAS filtre a huile.pdf
  Position invoices[1].src ; identifiant s19.
  Fichier invoices-s19-1791454538532.jpg
Les deux liens de facture renvoient HTTP 403 « Permission denied. ».
Les PDF originaux avaient été convertis en images JPEG par Atelier.
Ce sont ces deux images, et non l'ensemble des photos, qui sont inaccessibles.
Le 403 ne permet pas de déterminer à lui seul la cause : token invalidé,
accès Storage bloqué ou autre restriction côté serveur. La session Atelier
réelle n'a pas été utilisée pour ce contrôle. La lecture réseau hors navigateur
ne valide pas la configuration CORS de l'origine réelle du site.

INSTALLATION
1. Garder une copie de l'archive actuelle et exporter le rapport en JSON.
2. Publier le dossier wheelerBrothers-main comme pour la 52.3, en incluant
   le nouveau fichier report-images.js et sw.js. Utiliser le même hébergement.
3. Recharger l'application et vérifier « Version 52.3.1 » en haut du générateur.
Le cache d'application est versionné pour recevoir le nouveau fichier.
Les règles Firebase, la configuration métier et les logos sont conservés.

RÉPARER FR-709-WZ
1. Ouvrir le rapport existant dans « Mes rapports » et être connecté à Atelier.
   Éviter de réimporter le JSON dans un autre rapport si l'original existe déjà.
2. Cliquer sur « Vérifier les photos » dans l'aperçu. Toutes les images incluses
   dans le document sont contrôlées, même celles situées après la première erreur.
3. Si un lien actuel fonctionne, cliquer « Enregistrer le lien actuel ».
   Le diagnostic et la récupération pour lecture ne modifient pas le rapport.
4. Si les deux factures restent en 403, cliquer « Remplacer cette image »
   sur chacune des lignes et choisir le PDF original d'une page, ou son JPG/PNG.
   La nouvelle image est validée, envoyée à Storage, puis sa référence remplace
   uniquement celle de la facture ciblée. ID, nom, ordre et autres données restent
   identiques ; les anciens objets ne sont pas supprimés par ce remplacement.
   En cas d'échec d'envoi, la référence existante n'est pas remplacée.
5. Pour un PDF de plusieurs pages : utiliser le champ existant « Ajouter une ou
   plusieurs factures », vérifier les nouvelles pages, puis retirer la référence
   défaillante et remettre les pages dans l'ordre avec les flèches. Le bouton de
   suppression existant tente également de supprimer l'ancien objet Storage.
6. Cliquer sur « Réessayer », vérifier l'aperçu, puis générer le PDF et exporter
   un nouveau JSON comme sauvegarde. Les modifications utilisent l'enregistrement
   automatique habituel du générateur ; vérifier son statut de synchronisation.

SOLUTION TEMPORAIRE
Décoche « Inclure une (ou des) facture(s) à la fin du rapport » : l'aperçu et le
PDF se génèrent sans les deux factures, tout en conservant leurs références.
Cette action est enregistrée dans le rapport ; recocher après réparation.
Le document obtenu temporairement ne contient donc pas les factures.

CE QUE CHANGE LA 52.3.1
- Erreur A4/PDF : emplacement, prestation, côté, photo, ID et chemin du fichier.
- Distinction des erreurs HTTP observables 401/403/404, fichier vide, décodage,
  source intégrée invalide et URL locale indisponible. Réseau/CORS est indiqué
  comme indéterminé lorsque le navigateur ne permet pas de lire le statut HTTP.
- Tentative de résolution du lien Storage actuel avec la session Atelier
  après un échec du lien enregistré. Aucun changement des règles de sécurité.
- Boutons « Réessayer », « Vérifier les photos » et export du diagnostic.
- Remplacement ciblé d'une image après envoi réussi. Le logo est exclu du bouton
  de remplacement du diagnostic ; son fonctionnement habituel reste inchangé.
- Éviction des chargements en échec du cache : une erreur transitoire ne reste
  plus bloquée jusqu'au rechargement de l'application.
- Diagnostics sans tokens de téléchargement ni contenu des images.
Le PDF continue à s'arrêter si une image requise est inaccessible : aucune photo
n'est omise silencieusement pour fabriquer un rapport apparemment complet.

VALIDATION
Syntaxe des scripts vérifiée. Navigateur Edge isolé, Firebase simulé : 403 des
deux factures, 404, corruption, réseau/CORS, URL locale périmée, lien Storage
renouvelé, nouvel essai avec le même cache, remplacement ciblé, échec d'envoi
et changement de rapport pendant l'envoi. Diagnostic sans écriture vérifié.
Les 23 pages de ce rapport, avec les mêmes images de test substituées dans les
deux versions, sont identiques octet pour octet entre 52.3 et 52.3.1.
Logo PNG et constante du logo embarqué : identiques à l'archive originale.
Pas de déploiement ni de modification du rapport réel effectués. La réparation
finale demande la session Atelier ou les deux factures originales.

Références Firebase :
https://firebase.google.com/docs/storage/web/handle-errors
https://firebase.google.com/docs/storage/web/download-files
~~~~~

## LISEZ-MOI-52.3.2.txt

~~~~~text
WHEELERBROTHERS ATELIER 52.3.2 — RETOURS À LA LIGNE

Basé sur 52.3.1 : le correctif et le diagnostic des photos sont conservés.

Le moteur ajoutait une ligne vide après chaque retour à la ligne saisi.
Désormais :
- Entrée : ligne suivante, avec l'interligne normal du rapport.
- Deux Entrées : une vraie ligne vide entre les deux textes.
- Les textes longs continuent à revenir automatiquement à la ligne.
Le correctif concerne le résumé, les descriptions des prestations,
les recommandations et les libellés de contrôle dans l'aperçu A4 et le PDF.
Le texte enregistré n'est pas modifié. Logo et règles métier conservés.

INSTALLATION
Publier le dossier wheelerBrothers-main complet comme précédemment,
puis recharger et vérifier « Version 52.3.2 » dans le générateur.
Ouvrir le rapport existant : aucun besoin de ressaisir ses textes.

La procédure LISEZ-MOI-52.3.1.txt reste valable pour réparer les factures
en échec de FR-709-WZ. La 52.3.2 inclut tous les correctifs de la 52.3.1.
~~~~~

## LISEZ-MOI-52.3.3.txt

~~~~~text
WHEELERBROTHERS ATELIER v52.3.3 — INVENTAIRE : RUPTURE DE STOCK

Version construite à partir de WheelerBrothers Atelier v52.3.2.
Tous les correctifs de 52.3.1 et 52.3.2 (dont le diagnostic des images de
rapports et les retours à la ligne des PDF) sont conservés.

INVENTAIRE
- Les références dont la quantité est exactement 0 sont automatiquement
  mises en évidence (fond rouge très pâle, bordure rouge, badge « Rupture de stock »
  et quantité rouge), sur ordinateur comme sur mobile.
- La synthèse indique le nombre de références en rupture selon les filtres
  et la recherche en cours, lorsqu'il est supérieur à 0.
- Le marquage disparaît automatiquement dès que le stock repasse à 1 ou plus.
- Aucun changement à l'enregistrement dans Firebase, à l'import/export JSON,
  aux boutons de quantité, à la recherche ou aux filtres.

AUTRES MODULES
Carnet d'atelier et générateur de rapport inchangés sur le plan fonctionnel.
Logo WheelerBrothers conservé. Aucun changement de règles Firestore ou Storage.
WB Carnet reste indépendant : aucune mise à jour de ce dépôt requise.

DÉPLOIEMENT
Publier l'intégralité du dossier wheelerBrothers-main sur GitHub Pages,
puis recharger la page et vérifier « Version 52.3.3 » dans l'inventaire.
Le changement est purement visuel : aucune migration Firebase nécessaire.
~~~~~

## LISEZ-MOI-52.3.4.txt

~~~~~text
WHEELERBROTHERS ATELIER v52.3.4 — INVENTAIRE : CATÉGORIES

Base : Atelier v52.3.3. Les correctifs précédents (dont l'aperçu PDF et
la mise en évidence des articles à stock 0) sont conservés.

NOUVELLES PIÈCES
- La catégorie est désormais sélectionnée dans un menu déroulant.
- 28 catégories standardisées, dont Boîte de vitesses, Allumage et
  préchauffage, Filtres, Pneus, Freinage, Huiles et fluides,
  Suspension et bras, Amortissement, Échappement, Moteur,
  Courroies/chaînes/galets, Électricité, Refroidissement, Climatisation,
  Injection, etc.
- La sous-catégorie reste une saisie libre.

PIÈCES EXISTANTES (FIREBASE)
- Aucune modification automatique des articles stockés dans Firebase.
- Bouton « Réorganiser les catégories » dans l'inventaire.
- Propositions de reclassement des anciennes catégories (Filtration ->
  Filtres, Essuie glace -> Essuyage et lave-glace, etc.).
- Chaque proposition peut être modifiée via un menu déroulant.
- Les anciennes catégories inconnues sont conservées par défaut et
  signalées « À classer manuellement ».
- L'option « Afficher aussi les articles déjà classés » permet de
  corriger manuellement n'importe quelle référence.
- Une confirmation explicite et une sauvegarde JSON automatique
  précèdent l'enregistrement dans Firestore.
- La sauvegarde peut être réimportée via « Importer (.json) ».
- L'édition d'un article ancien conserve sa catégorie initiale sauf
  changement volontaire de l'utilisateur.
- Une nouvelle installation utilise les catégories standardisées pour
  ses exemples initiaux.

AUTRES MODULES
Aucun changement métier dans le Carnet d'atelier et le Générateur de
rapport ; logo WheelerBrothers conservé. Aucune modification des règles
Firebase, de la structure des documents, ni des quantités en stock.
WB Carnet reste en v8.3.

DÉPLOIEMENT
Déployer le dossier wheelerBrothers-main, puis recharger l'application.
La version doit afficher 52.3.4. L'inventaire déjà en ligne n'est pas
reclassé tant que tu n'as pas validé l'action correspondante.
~~~~~

## LISEZ-MOI-Atelier-v53.3.txt

~~~~~text
WHEELERBROTHERS ATELIER — MISE À JOUR 53.3

BASE
Archive complète wheelerBrothers-main.zip fournie, dont les fichiers du correctif
Atelier v53.2 correspondent au ZIP WheelerBrothers_Atelier_v53.2_modifies.zip.
Ce ZIP est une mise à jour différentielle, pas une installation complète.

MODIFICATIONS
- Classique et IA : chiffres seuls pour le kilométrage ; affichage 100 000.
  Valeur enregistrée/transmise : chaîne "100000", convertible avec Number().
  Ce type texte conserve le contrat du serveur IA v53.2 et du carnet existant.
- Plaques SIV françaises : majuscules et tirets AA-123-BB.
- « Autre format » décochée pour une nouvelle saisie ; saisie libre si cochée.
  Les anciennes plaques non SIV sont conservées et rouvertes en mode libre.
- Recherche uniquement au clic Vérifier ; clés sans casse, espaces ni tirets.
- Motorisation et première mise en circulation toujours présentes dans l’IA.
- Kilométrage formaté sur les pages PDF ; références actives/cache en 53.3.

DÉPLOIEMENT
1. Sauvegarder les fichiers actuellement déployés.
2. Extraire ce ZIP. Copier tous les fichiers applicatifs listés ci-dessous à la
   racine du site Atelier existant, au même niveau que index.html, en remplaçant
   les fichiers homonymes. Ajouter impérativement vehicle-input.js.
   Les deux fichiers LISEZ-MOI et VERIFICATION peuvent rester hors du site.
3. Ne pas supprimer les autres fichiers de l’installation existante.
4. Publier avec la procédure habituelle de votre hébergeur. Si un CDN est utilisé,
   invalider son cache pour les fichiers remplacés. Mettre tous les fichiers
   en ligne ensemble (ou sw.js en dernier si le transfert est séquentiel).
5. Recharger le site connecté à Internet, puis fermer et rouvrir les onglets/PWA
   si nécessaire. Vérifier « Version 53.3 », y compris l’écran de connexion.
6. Contrôler dans les deux formulaires : aa123bb -> AA-123-BB ; 100000 -> 100 000 ;
   Autre format -> saisie libre ; Vérifier -> fiche et alerte km si nécessaire.
   Créer un rapport de contrôle et vérifier le PDF avant utilisation courante.

FIREBASE / SERVEUR IA
Aucune règle, collection, clé, configuration Firebase ni fonction serveur modifiée.
Dans firebase-config.js, seul le libellé « Version 53.2 » devient « Version 53.3 ».
Conserver le serveur IA v53.2 déjà déployé ; aucun npm install ni déploiement
Functions nécessaire pour cette mise à jour de l’interface.

VALIDATION
Tests locaux automatisés avec carnet simulé et navigateur Edge, en 1440 et 390 px.
Aucun accès au carnet de production et aucun appel OpenAI facturable.
Les écritures Firebase réelles, l’analyse IA distante et le déploiement en
production n’ont pas été exécutés lors de ces tests.

Contrôles réussis :
- Tous les fichiers du cache existent ; configuration Firebase inchangée hors numéro affiché.
- Classique : formatage, valeur brute, aucune lecture à la saisie, Vérifier retrouve une ancienne plaque sans tirets et compare le kilométrage.
- Fiches existantes : ancienne plaque conservée en mode libre, kilométrage historique nettoyé, nouveau rapport en mode français.
- Rendu PDF : pages générées et kilométrage affiché avec espaces.
- Plaques verrouillées dans les deux formulaires : lettres/chiffres à leur position, sept caractères utiles maximum, frappe et collage filtrés.
- IA : champs persistants visibles, formatage, saisie libre, recherche au clic et avertissement kilométrique.
- Saisie au milieu du kilométrage : curseur conservé ; formulaire contrôlé en 1440 px et 390 px.
- Tous les scripts JavaScript : syntaxe valide ; aucune erreur navigateur.

Fichiers applicatifs ajoutés/modifiés :
- atelier.html
- firebase-config.js
- index.html
- inventaire.html
- rapport.html
- report-ai-core.js
- report-ai.css
- report-ai.js
- report-images.js
- sw.js
- vehicle-input.js

RETOUR ARRIÈRE
Restaurer les fichiers sauvegardés de la v53.2, y compris sw.js, puis recharger
le site connecté. Aucune migration de données n’a été réalisée.
~~~~~

## LISEZ-MOI-Atelier-v54.1.txt

~~~~~text
WheelerBrothers Atelier v54.1 — Correctif de v54

Copier les quatre fichiers HTML/JS à la racine du dépôt Atelier.
- Planning : bandeau supérieur harmonisé avec Inventaire.
- Formulaire : immatriculation et bouton Vérifier, marque, modèle, propriétaire modifiables.
- Recherche explicite dans spaces/{spaceId}/tools/atelier, document payload JSON, correspondance normalisée de la plaque.
- Affichage : marque modèle / plaque - propriétaire / travaux, dans la liste et le calendrier.
- Anciennes interventions conservées (champ vehicle historique en repli).
- Cache SW actualisé ; aucune modification du serveur IA ni des règles Firebase attendue.

Tester sur Firebase réel : une fiche existante, une plaque inconnue, une intervention ancienne, iPhone.
~~~~~

## LISEZ-MOI-Atelier-v54.txt

~~~~~text
WHEELERBROTHERS ATELIER — VERSION 54 — PLANNING

BASE : archive complète wheelerBrothers-main.zip fournie par l'utilisateur, v53.3 validée.

INSTALLATION
Copier uniquement les fichiers de ce ZIP à la racine du site Atelier en conservant les noms. Ne pas effacer les autres fichiers du dépôt. Publier sur GitHub Pages, recharger le site en ligne puis rouvrir la PWA si besoin.
Aucun redéploiement de la fonction IA n'est nécessaire.

NOUVEAU MODULE
- Bouton Planning sur l'accueil.
- À prévoir : interventions sans date ; En retard : opérations dont la dernière date est passée ; terminées consultables.
- Calendrier mois/semaine, plusieurs interventions par jour, toutes en journées entières.
- Sélection de jours non consécutifs ou période consécutive par toucher/glissement.
- Création, édition, suppression ; statuts À prévoir / Planifié / Terminé.
- Firestore temps réel : spaces/{spaceId}/planningItems/{itemId}.
- Données de planning indépendantes des rapports et du carnet.

ATTENTION AUX REGLES FIRESTORE
Le nouveau module utilise une collection Firestore planningItems dans l'espace Atelier.
Vérifier que vos règles Firestore existantes autorisent les opérations read/create/update/delete sur /spaces/{spaceId}/planningItems/{itemId} POUR LE COMPTE ATELIER UNIQUEMENT.
Si la règle actuelle couvre déjà les sous-collections de l'espace, aucun changement nécessaire.
Si la règle refuse cette collection, il faudra adapter les règles AVANT de pouvoir enregistrer. Ne pas ouvrir l'accès public.
Le code atelier ne donne pas automatiquement un accès Firebase à plusieurs comptes ; les sessions doivent disposer des droits prévus par les règles.

VERIFICATIONS RECOMMANDEES
1. Ouvrir Planning depuis l'accueil, vérifier « Planning synchronisé avec Firebase ».
2. Créer une intervention sans date et vérifier son apparition dans « À prévoir ».
3. Ajouter des dates non consécutives et une période ; vérifier calendrier mois et semaine.
4. Vérifier plusieurs interventions sur une date ; marquer terminé ; reporter ; supprimer.
5. Tester depuis les deux appareils connectés et vérifier la synchronisation.
6. Vérifier le comportement tactile sur iPhone réel (non testé ici).

VERIFICATIONS LOCALES
Syntaxe JavaScript vérifiée avec node --check ; archives vérifiées avec zipfile.testzip().
Pas de test navigateur iOS ou Firebase en production réalisé.
~~~~~

## LISEZ-MOI-iPhone.md

~~~~~text
> **Important — version 48 / WB Carnet**  
> Les instructions Firebase historiques ci-dessous décrivent l'installation initiale de WheelerBrothers.  
> Pour activer le partage WB Carnet et l'authentification par SMS, utilise d'abord `CONFIGURATION-WB-CARNET.md` et les règles du dossier `Firebase` du paquet complet. Le forfait Blaze est requis pour les vrais SMS de vérification.

# Outils Atelier — installation sur iPhone (app perso, hors App Store)

Contenu du dossier :
- `index.html` — écran d'accueil avec les 2 outils
- `atelier.html` — Carnet d'atelier
- `rapport.html` — Générateur de rapport
- `manifest.json`, `sw.js` — fichiers techniques PWA (icône, mode plein écran, hors-ligne)
- icônes (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`)

## Étape 1 — Créer la base de données partagée (Firebase, gratuit)

1. Va sur https://console.firebase.google.com et connecte-toi avec un
   compte Google (le tien, pas besoin que ton binôme en ait un).
2. "Ajouter un projet" → donne-lui un nom (ex. `outils-atelier`) →
   laisse Google Analytics désactivé (pas nécessaire) → Créer.
3. Dans le projet, clique l'icône **Web `</>`** pour ajouter une "Web App"
   → donne-lui un nom → "Enregistrer l'app".
4. Firebase affiche un bloc de code avec `firebaseConfig = {...}` :
   copie les valeurs (`apiKey`, `authDomain`, `projectId`, etc.).
5. Ouvre le fichier **`firebase-config.js`** (dans ce dossier) et
   colle ces valeurs à la place de `COLLE_ICI...`.
6. Dans le menu de gauche Firebase, va dans **Base de données et
   stockage** → section **noSQL** → **Firestore** (à ne pas confondre
   avec "Realtime Database", juste au-dessus). Clique **"Créer une
   base de données"** :
   - Édition **Standard** → Suivant
   - ID de base de données : laisse `(default)` → Suivant
   - Région proche (ex. `eur3 (europe-west)`) → Suivant
   - Règles de sécurité de démarrage : peu importe ton choix ici, on
     les remplace à l'étape suivante → **Créer**.
7. Onglet **Règles** de Firestore, remplace le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /spaces/{spaceId}/{document=**} {
      allow read, write: if spaceId.size() >= 12;
    }
  }
}
```

   Cette règle autorise l'accès à tout ce qui se trouve sous un espace
   (`spaces/{code}/...`, quelle que soit la collection : carnet
   d'atelier, rapports archivés, etc.) uniquement si on connaît le code
   exact (au moins 12 caractères) — c'est ta "mot de passe" d'atelier.
   Clique "Publier".

## Étape 1 bis — Activer Firebase Storage (pour les photos volumineuses)

Les photos des rapports sont stockées séparément (Firebase Storage)
plutôt que dans Firestore, pour ne jamais être limitées par les 1 Mo
par document. Depuis février 2026, Storage nécessite le plan **Blaze**
(paiement à l'usage) — mais il reste un quota gratuit confortable
(~1 Go stockage, ~10 Go de téléchargement/mois) avant toute
facturation, et le coût au-delà est très faible (quelques centimes par
Go). Aucun abonnement à prix fixe : tu ne payes que ce que tu dépasses,
le cas échéant.

1. Dans la console Firebase, va dans **Project Settings** (icône ⚙️) →
   **Usage and billing** → **Modify plan** → choisis **Blaze**. Il te
   demandera de lier un compte de facturation Google Cloud (carte
   bancaire).
2. Dans le menu de gauche, va dans **Base de données et stockage** →
   section **Stockage d'objets** → **Storage** → **Créer un bucket**
   (garde les réglages par défaut) → choisis la même région que ta
   base Firestore.
3. Onglet **Règles** de Storage, remplace le contenu par :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /spaces/{spaceId}/{allPaths=**} {
      allow read, write: if spaceId.size() >= 12;
    }
  }
}
```

   Même principe que pour Firestore : accès protégé par la connaissance
   du code d'atelier. Clique "Publier".

**Surveiller les coûts** : dans Project Settings → Usage and billing,
tu peux consulter ta consommation à tout moment, et définir une alerte
de budget (ex. 1€) pour être prévenu si jamais l'usage dépasse le
gratuit — précaution simple, pas obligatoire vu les montants en jeu.

## Étape 2 — Héberger gratuitement sur GitHub Pages

1. Va sur https://github.com et crée un compte si tu n'en as pas (gratuit).
2. Crée un nouveau dépôt (bouton "New repository"), nomme-le par exemple
   `outils-atelier`. Peu importe qu'il soit public : le code de l'appli
   ne contient aucune donnée personnelle, seulement `firebase-config.js`
   qui contient ta config Firebase — normal et sans risque, la vraie
   protection est la règle Firestore ci-dessus, pas le secret de ce fichier.
3. Sur la page du dépôt, clique "Add file" → "Upload files", et dépose
   tous les fichiers de ce dossier (garde-les à la racine, pas dans un
   sous-dossier), **y compris ton `firebase-config.js` déjà rempli**.
4. Valide ("Commit changes").
5. Va dans **Settings** du dépôt → **Pages** (menu de gauche) → sous
   "Build and deployment", choisis **Deploy from a branch**, branche
   `main`, dossier `/ (root)`. Enregistre.
6. Après 1-2 minutes, l'URL de ton site apparaît, du type :
   `https://<ton-pseudo>.github.io/outils-atelier/`

## Étape 3 — Installer sur ton iPhone (et celui de ton binôme)

1. Ouvre cette URL dans **Safari** (obligatoire, pas Chrome sur iOS).
2. Bouton de partage → **"Sur l'écran d'accueil"** → Ajouter.
3. **Au premier lancement de chaque outil**, une fenêtre demande le
   "code d'atelier partagé" :
   - **Toi (le premier)** : accepte le code proposé par défaut, puis
     transmets-le tel quel à ton binôme (message, capture d'écran...).
   - **Ton binôme** : colle exactement ce même code au lieu d'en
     accepter un nouveau.
4. À partir de là, vos deux téléphones lisent/écrivent dans le même
   espace : les changements de l'un apparaissent chez l'autre en
   quelques instants (avec réseau).

## Fonctionnement hors-ligne

Les deux outils fonctionnent aussi sans réseau (Firestore met en cache
localement et resynchronise automatiquement dès que la connexion
revient). Le Générateur de rapport limite les écritures réseau à une
toutes les 600 ms pendant la saisie, pour rester fluide.

## Limites à connaître

- **Ce n'est pas de l'édition collaborative avec fusion intelligente.**
  Si vous modifiez le **même champ, au même moment**, la dernière
  écriture gagne et écrase l'autre. En usage normal (l'un ajoute une
  intervention, l'autre consulte ou complète autre chose), ça ne pose
  aucun souci.
- Le code d'atelier est la seule protection d'accès (pas de compte
  utilisateur). Ne le partage qu'avec ton binôme. **Il doit faire au
  moins 12 caractères** — l'app le refuse désormais automatiquement
  s'il est trop court (avant, un code trop court échouait en silence
  côté Firestore, sans message d'erreur : corrigé).
- Pour changer de code (erreur de frappe, nouveau binôme...), utilise
  le lien "Changer le code d'atelier" en bas de l'écran d'accueil.
- Le stockage Firestore gratuit (Spark) offre une capacité largement
  suffisante pour un usage à deux (environ 1 Go de données, 50 000
  lectures et 20 000 écritures par jour) — non facturé.
- **Les photos sont automatiquement envoyées vers Firebase Storage**
  (pas dans Firestore), donc la limite de 900 Ko/1 Mo par rapport ne
  s'applique plus qu'au texte — largement suffisant. L'indicateur de
  taille dans la barre d'outils ne reflète maintenant plus le poids des
  photos une fois uploadées (juste le temps de l'upload, il peut
  brièvement rester élevé). Si l'upload échoue (pas de réseau), la
  photo reste temporairement stockée en local dans le rapport — normal,
  elle repartira vers Storage dès la prochaine sauvegarde en ligne.
- **Import d'un ancien `.json` ou réouverture d'un rapport créé avant
  cette mise à jour** : les photos encore encodées en base64 sont
  détectées et migrées automatiquement vers Storage dès l'ouverture,
  en arrière-plan. Il est normal de voir brièvement le bandeau "trop
  volumineux" clignoter le temps que la migration se termine (quelques
  secondes selon le nombre de photos et la connexion) — il disparaît
  de lui-même une fois les photos basculées.

## Archiver plusieurs rapports

Le générateur de rapport garde maintenant en mémoire **tous** les
rapports que tu crées, pas juste le dernier :

- Bouton **📁 Mes rapports** (en haut) : ouvre la liste de tous les
  rapports enregistrés dans l'espace partagé (visible par toi et ton
  binôme), triés du plus récent au plus ancien.
- **+ Nouveau rapport** : démarre une page blanche, sans perdre le
  rapport en cours (il reste dans la liste).
- Cliquer sur un rapport de la liste le rouvre pour le consulter ou le
  modifier — tu peux repartir d'un ancien rapport et l'adapter plutôt
  que de tout ressaisir.
- Bouton **supprimer** sur chaque ligne pour nettoyer les rapports
  obsolètes.
- Si tu avais déjà un rapport en cours avant cette mise à jour, il est
  automatiquement récupéré comme premier élément de l'archive au
  prochain lancement (rien n'est perdu).

## Sauvegarde de secours

Chaque outil garde ses boutons **Exporter / Importer (JSON)**, utiles
pour un archivage ponctuel indépendant de Firebase.

## Mettre à jour l'app plus tard

Si tu modifies les fichiers :
1. Remplace-les sur GitHub (Add file → Upload files, en écrasant les
   anciens).
2. Change `CACHE_NAME` dans `sw.js` (ex. passer à `-v3`) pour forcer
   le rafraîchissement du cache.
3. Rouvre l'app sur les deux téléphones (avec réseau une fois).

## Mettre à jour l'app plus tard

Si tu modifies les fichiers (nouvelle fonctionnalité, correctif) :
1. Remplace les fichiers sur GitHub (Add file → Upload files, en
   écrasant les anciens).
2. Change le nom `CACHE_NAME` dans `sw.js` (ex. `outils-atelier-v2`)
   pour forcer le rafraîchissement du cache.
3. Rouvre l'app sur ton iPhone (avec réseau une fois) pour qu'elle
   récupère la nouvelle version.

## Et si un jour tu veux la vraie app native (Xcode) ?

Puisque tu as un Mac, l'étape suivante logique serait d'emballer ces
mêmes fichiers avec **Capacitor** (https://capacitorjs.com) pour obtenir
une app iOS native avec stockage fichier réel et installation via
Xcode/câble USB — plus solide que le stockage navigateur, mais demande
plus de mise en place. Dis-moi si tu veux qu'on parte sur cette voie.

## Configuration CORS requise pour les photos dans les PDF

Pour qu'une photo déjà enregistrée dans Firebase Storage puisse être relue et intégrée au PDF par le navigateur, applique une fois la configuration décrite dans `CONFIGURER-CORS-FIREBASE.md`. L'upload et l'affichage des photos peuvent fonctionner sans CORS, mais pas leur lecture binaire par le canvas PDF.
~~~~~

## LISEZ-MOI-v54.2-COMPLET.txt

~~~~~text
WheelerBrothers Atelier v54.2 — ARCHIVE COMPLÈTE

Cette archive contient l’ensemble des fichiers du site Atelier, assemblés à partir de :
- dépôt wheelerBrothers-main fourni (v53.3) ;
- correctif v54 ;
- correctif v54.1 ;
- correctif v54.2 corrigé (affichage iPhone, accueil et cache).

Installation : remplacer les fichiers correspondants à la racine du dépôt GitHub.
Ne pas supprimer les autres fichiers propres à votre dépôt qui ne figurent pas dans cette archive.
Aucune modification des fonctions Firebase IA n’est requise.

Le code n’a pas été testé sur un iPhone réel ni sur votre instance Firebase.
~~~~~

## README-BANDEAUX-49.9.md

~~~~~text
# WheelerBrothers v49.9

Modification visuelle uniquement :

- le bandeau du Carnet d’atelier repasse en noir ;
- le bandeau du Générateur de rapport repasse en noir ;
- la structure homogène de la v49.8 est conservée : flèche de retour, titre, pastille Firebase et version ;
- l’Inventaire conserve son bandeau blanc.

Aucune modification Firebase n’est nécessaire.
~~~~~

## README-CORRECTIF-49.4.md

~~~~~text
# WheelerBrothers 49.6 — correctif de chargement

Cette version corrige :

- le SDK Firebase Authentication manquant sur l’accueil, le générateur et l’inventaire ;
- le chargement des modules avant la récupération du véritable `spaceId` privé ;
- le bouton « Changer le code d’atelier » qui appelait une ancienne fonction supprimée ;
- le bouton « Forcer la mise à jour » qui ne recevait plus son gestionnaire à cause de cette erreur JavaScript.

Les données Firestore ne sont ni déplacées ni effacées.
~~~~~

## README-CORRECTIF-49.6.md

~~~~~text
# WheelerBrothers v49.6 — correctif Carnet atelier

- restaure l’attente de `window.atelierReady` avant le chargement du Carnet atelier ;
- conserve l’authentification sécurisée et l’interface de la v49.5 ;
- met à jour le cache et les références de version en 49.6.

Aucune modification Firebase n’est nécessaire.
~~~~~

## README-ENTETES-49.8.md

~~~~~text
# WheelerBrothers 49.8

Harmonisation des en-têtes de Carnet d’atelier, Rapport d’intervention et Inventaire : bandeau blanc, flèche de retour, version sous le titre, pastille Firebase à gauche de la version et suppression du logo dans les outils. L’emoji du titre Rapport d’intervention est retiré.
~~~~~

## README-MISE-A-JOUR-49.3.md

~~~~~text
# WheelerBrothers v49.6

Correctif du bouton « Forcer la mise à jour » : les liens vers Carnet, Rapport et Inventaire comportent désormais la version, chaque page met à jour le service worker, et les fichiers locaux sont demandés au réseau avant le cache.

Aucune modification Firebase n’est nécessaire.
~~~~~

## README-MISE-A-JOUR-49.4.md

~~~~~text
# WheelerBrothers v49.6

Correctif du bouton « Forcer la mise à jour » : les liens vers Carnet, Rapport et Inventaire comportent désormais la version, chaque page met à jour le service worker, et les fichiers locaux sont demandés au réseau avant le cache.

Aucune modification Firebase n’est nécessaire.
~~~~~

## README-MISE-A-JOUR-49.5.md

~~~~~text
# WheelerBrothers v49.6

Modifications :
- suppression du bouton « Forcer la mise à jour » de l’accueil ;
- affichage de la version 49.6 sur l’écran de saisie du code atelier ;
- conservation du correctif de chargement des données de la v49.4.
~~~~~

## README-SECURISATION.md

~~~~~text
# WheelerBrothers v49.2

Ajout d’un bouton **Forcer la mise à jour** sur la page d’accueil.

Le bouton supprime uniquement le cache statique de WheelerBrothers (`outils-atelier-*`), désinscrit son service worker puis recharge depuis le réseau. Il ne supprime pas les données Firestore, les rapports, l’inventaire, la session Firebase, l’historique Safari, les cookies, le localStorage ou l’IndexedDB.

Pour obtenir cette version une première fois sur iPhone après publication, ouvrir dans Safari :
`https://tdyfa.github.io/wheelerBrothers/?maj=49.2`
~~~~~

## README-STATUT-FIREBASE-49.7.md

~~~~~text
# WheelerBrothers v49.8 — statut Firebase

Cette version ajoute une icône de statut en haut de chaque outil :

- verte : compte atelier authentifié, configuration Firebase chargée et appareil en ligne ;
- rouge : session absente, configuration indisponible ou appareil hors ligne.

Outils concernés :

- Carnet d'atelier ;
- Générateur de rapport ;
- Inventaire.

L'icône ne déclenche aucune lecture périodique supplémentaire dans Firestore.
Aucune modification des règles Firebase n'est nécessaire.
~~~~~

## README.md

~~~~~text
<!--
HISTORIQUE DES VERSIONS

v52.3
- Correction de l’export PDF de l’historique lorsqu’une opération est trop longue pour tenir sur une page.
- Une opération longue commence désormais dans l’espace disponible puis continue sur la page suivante.
- L’en-tête du tableau est répété sur chaque page de continuation.
- La date et le kilométrage restent affichés uniquement au début de l’opération.

v52.2
- Correction du calcul du taux horaire moyen par véhicule et de la moyenne générale.
- Les opérations dont le temps est égal à 0 ou dont la rémunération est égale à 0 sont exclues du calcul du taux moyen.
- Les totaux de temps et de rémunération continuent à inclure toutes les opérations.

v52.1
- Correction iPhone : la pastille « Rapport lié » s’ajuste désormais à la largeur du texte.

v52
- Le champ Résumé du Générateur de rapport devient obligatoire.
- Le Résumé devient l’intitulé de l’opération créée ou mise à jour dans le Carnet d’atelier.
- Les prestations et leurs descriptions sont enregistrées dans les Notes sous forme de liste à puces.
- Les Notes du Carnet d’atelier acceptent et affichent désormais plusieurs lignes.

v52
- Ajout de la mention « Rapport lié » sur chaque intervention associée à un rapport dans le Carnet d’atelier.

v51
- Partage des rapports liés aux opérations vers WB Carnet, sans enregistrer de PDF.
- Ajout des références reportId et reportSpaceId aux opérations synchronisées.
- Marquage sécurisé du rapport source avec le véhicule WB Carnet autorisé.
- Conservation du partage lors des sauvegardes ultérieures du rapport.
- Synchronisation automatique des fiches déjà liées à l’ouverture du Carnet d’atelier.

v50.2
- Correction renforcée du champ Date sur Safari iPhone.
- Stabilisation de la carte Accès WB Carnet après modification d’une intervention.

v50
- Retrait d’une fiche et désactivation globale d’un compte WB Carnet.

v49
- Authentification Firebase du compte atelier unique.
- Intégration du partage vers WheelerBrothers Carnet.
-->

# WheelerBrothers Atelier — version 52.3

Application comprenant le Carnet d’atelier, le Générateur de rapports, l’Inventaire et le partage sécurisé vers WheelerBrothers Carnet.

## Rapports accessibles dans WB Carnet

Lorsqu’une opération provient du Générateur de rapport et que le véhicule est partagé :

- l’opération synchronisée contient l’identifiant du rapport ;
- le document source du rapport est marqué pour le véhicule WB Carnet concerné ;
- les sauvegardes suivantes conservent ce marquage ;
- aucun fichier PDF n’est envoyé dans Firebase Storage.

Le PDF est généré à la demande sur l’appareil du proche à partir du rapport Firestore et des photos déjà présentes dans Storage.

## Liaison rapport → Carnet d’atelier

Le champ **Résumé** est obligatoire lors de la sauvegarde et de la génération du PDF. Il devient l’intitulé de l’intervention créée dans le Carnet d’atelier.

Les prestations sont enregistrées dans les Notes sous cette forme :

```text
• Intitulé de la prestation
  – Description ou détails de la prestation
```

Une sauvegarde ultérieure du même rapport met à jour l’opération existante grâce au `reportId`.

## Déploiement

Placer tous les fichiers à la racine du dépôt GitHub Pages `wheelerBrothers`.

Publier ensuite les règles Firestore et Storage fournies dans le dossier Firebase du paquet complet.
~~~~~

## VERIFICATION-Atelier-v53.3.txt

~~~~~text
SHA-256 des fichiers applicatifs livrés

915c037c42b6a16b72c3c508f594af98143dd9ece296849404190ec42beede15  atelier.html
1ccfda0e90391b146a445d7c652820bbc6a8304249a981f4cdc4f3039892889e  firebase-config.js
3b95ca8ae0cc4d5db3e5705431c9bd39f70670a84477bf8fcfefc174eafebf8f  index.html
495be459ea18130d26a29efe431808f7a03d3646d40a662b6fb371c7cf08d897  inventaire.html
78181bbb96c411e2c76d406dea77d412fe2b707cc6227f06b8b27e41804601fa  rapport.html
e2cd71a6fb7e2a536ff166bffac41aad43e0afa5a3bff239706ed0973abc34b9  report-ai-core.js
71738ecc37c86be4d6dc8b17b8661d269874c679e979be0abdedaefd03b0331c  report-ai.css
05ad12364e53ad81466941425a900ddf4c304bc78afa9b531d82a9912b985d4d  report-ai.js
34ea4ad8e6f4ff39758cc0b74398b4893c6a07f0f47af75ed2f661174d2f24a2  report-images.js
4543623a21fb9772512178cf6a84c1b2046670773c7eb31e99b6d56589c4d729  sw.js
4111216b40056a68182e681ee2e7ce007a180e27543379c024455f6f0d1667ea  vehicle-input.js
~~~~~

