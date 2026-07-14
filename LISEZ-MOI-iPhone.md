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
