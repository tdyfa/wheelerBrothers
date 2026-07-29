# Configuration Firebase nécessaire pour WB Carnet

Projet Firebase utilisé : `wheelerbrothers`.

WB Carnet utilise le même projet que WheelerBrothers, mais des collections Firestore séparées et Firebase Authentication par téléphone.
Aucune Cloud Function et aucun serveur supplémentaire ne sont nécessaires.

## 1. Vérifier le forfait Firebase

L'envoi de vrais codes de vérification par SMS avec Firebase Authentication nécessite le forfait **Blaze** (paiement à l'usage).
Le projet utilise déjà Firebase Storage pour les photos des rapports, mais il faut tout de même vérifier dans :

`Firebase Console → Paramètres du projet → Utilisation et facturation`

Les numéros de test configurés dans Firebase ne déclenchent pas de vrai SMS et ne consomment pas le quota d'envoi.

## 2. Activer la connexion par téléphone

Dans la console Firebase :

1. `Authentication` → `Sign-in method` ;
2. activer **Phone / Téléphone** ;
3. enregistrer.

WB Carnet utilise un code SMS à usage unique. Il n'y a ni adresse e-mail, ni mot de passe, ni adresse fictive.

## 3. Autoriser les SMS vers la France

Dans :

`Authentication → Settings → SMS region policy`

Autoriser au minimum **France**.
Pour les nouveaux projets, aucune région peut être autorisée par défaut.

## 4. Autoriser le domaine GitHub Pages

Dans :

`Authentication → Settings → Authorized domains`

Ajouter, s'il n'est pas déjà présent :

```text
tdyfa.github.io
```

Il faut renseigner le domaine, sans `https://` et sans le nom du dépôt.
Ce même domaine couvre WheelerBrothers et WB Carnet lorsqu'ils sont tous les deux hébergés sous `https://tdyfa.github.io/...`.

## 5. Publier les nouvelles règles Firestore

Dans :

`Firestore Database → Rules`

Remplacer le contenu actuel par le contenu du fichier :

```text
firestore.rules
```

Puis cliquer sur **Publier**.

Ces règles :

- conservent la règle historique de `spaces/{code}` utilisée par WheelerBrothers actuel ;
- protègent les collections WB Carnet avec l'identité Firebase (`uid`) et les accès par véhicule ;
- vérifient que le numéro authentifié correspond au numéro de l'invitation ;
- rendent les opérations WheelerBrothers non modifiables côté WB Carnet ;
- permettent uniquement à l'auteur de modifier ou supprimer une opération personnelle ;
- permettent l'activation atomique et la fusion sécurisée des fiches portant la même immatriculation.

Le fichier `firestore.indexes.json` ne contient aucun index composite : les requêtes de la v1 utilisent les index automatiques de Firestore. Il n'y a donc aucun index manuel à créer.

## 6. Firebase Storage et CORS

WB Carnet v1 ne stocke ni photo ni pièce jointe. Il n'y a donc :

- aucune nouvelle règle Storage obligatoire ;
- aucune modification CORS obligatoire ;
- aucun nouveau bucket à créer.

Le fichier `storage.rules` est fourni comme référence. Il conserve la règle Storage actuelle de WheelerBrothers et interdit un éventuel dossier `wbCarnet` tant que les pièces jointes ne sont pas utilisées.

## 7. Configurer des numéros de test avant les vrais SMS

Dans :

`Authentication → Sign-in method → Phone numbers for testing`

Configurer idéalement deux numéros fictifs :

- un numéro pour le compte qui gère le partage depuis WheelerBrothers ;
- un autre numéro pour le proche qui active l'invitation dans WB Carnet.

Associer à chacun un code à six chiffres. Firebase n'enverra aucun SMS réel pour ces numéros.

Le test complet est alors :

1. ouvrir la version 48 de WheelerBrothers ;
2. ouvrir une fiche véhicule et choisir **Partager avec un proche** ;
3. se connecter avec le numéro administrateur de test ;
4. inviter le second numéro de test ;
5. copier le lien généré et l'ouvrir dans WB Carnet ;
6. saisir le code de test du second numéro ;
7. vérifier que l'accès passe à **Actif** dans le carnet d'atelier.

## 8. Collections créées automatiquement

Aucune collection ne doit être créée manuellement. Les applications créeront :

```text
wbCarnetUsers
wbCarnetVehicles
wbCarnetVehicles/{vehicleId}/members
wbCarnetVehicles/{vehicleId}/operations
wbCarnetInvitations
```

Les données existantes de WheelerBrothers restent sous `spaces/{code}` et ne sont ni déplacées ni restructurées.

## 9. Traitement des numéros de téléphone

Firebase indique que les numéros fournis pour l'authentification sont envoyés et stockés par Google afin d'assurer la vérification et la prévention du spam et des abus. Les écrans générés affichent cette information avant l'envoi du code.

## Résumé des impacts Firebase

| Élément | Impact |
|---|---|
| Projet Firebase | Le projet actuel est conservé |
| Forfait | Blaze requis pour les vrais SMS de vérification |
| Authentication | Activer le fournisseur Téléphone |
| Régions SMS | Autoriser la France |
| Domaines autorisés | Ajouter `tdyfa.github.io` |
| Firestore Rules | Remplacer par `firestore.rules` fourni |
| Index Firestore | Aucun index composite à créer |
| Storage | Aucun changement obligatoire pour WB Carnet v1 |
| CORS | Aucun changement obligatoire |
| Cloud Functions | Aucune |
