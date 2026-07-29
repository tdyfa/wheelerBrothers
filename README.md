<!--
HISTORIQUE DES VERSIONS

v49.10
- Alignement de « MàJ Carnet » sur la ligne du statut Firebase et de la version dans le générateur de rapport.
- Centrage des boutons Exporter et Importer dans l’en-tête du Carnet d’atelier.
- Regroupement de la documentation dans ce fichier unique.

v49.9
- Bandeaux noirs dans le Carnet d’atelier et le Générateur de rapport.

v49.8
- En-têtes homogènes entre les outils.
- Flèche de retour, titre, statut Firebase et version harmonisés.
- Suppression du logo WheelerBrothers dans les outils.
- Suppression de l’emoji du titre Rapport d’intervention.

v49.7
- Ajout d’une pastille de statut Firebase dans Carnet, Rapport et Inventaire.

v49.6
- Correction du chargement différé des données du Carnet d’atelier après authentification.

v49.5
- Ajustements d’interface et affichage de la version sur l’écran du code atelier.

v49.4
- Correction du chargement sécurisé de Carnet, Rapport et Inventaire.
- Correction des boutons de changement de code et de mise à jour.

v49.3
- Mise à jour cohérente de toutes les pages et du service worker.

v49
- Authentification Firebase du compte atelier unique.
- Lecture privée de la configuration de l’espace existant.
- Intégration du partage vers WheelerBrothers Carnet.
-->

# WheelerBrothers Atelier

Application web d’atelier comprenant :

- Carnet d’atelier ;
- Générateur de rapports d’intervention ;
- Inventaire ;
- partage de véhicules vers WheelerBrothers Carnet.

## Déploiement

Les fichiers doivent être placés à la racine du dépôt GitHub Pages `wheelerBrothers`. Le fichier `index.html` doit donc se trouver directement à la racine.

Après un déploiement, le numéro de version présent dans les pages et dans `sw.js` permet au service worker de renouveler le cache statique. Les données métier restent stockées dans Firebase et ne sont pas supprimées par une mise à jour des fichiers GitHub Pages.

## Authentification de l’atelier

WheelerBrothers utilise un compte Firebase Authentication unique avec adresse e-mail et mot de passe. L’interface demande uniquement le code atelier, qui correspond au mot de passe de ce compte.

L’ancien code d’espace reste utilisé comme identifiant technique pour retrouver les données existantes sous :

```text
/spaces/ANCIEN_CODE_ATELIER/...
```

La configuration privée est enregistrée dans Firestore sous :

```text
wbAtelierConfig/main
```

avec les champs `spaceId` et `adminUid`.

## Firebase

La configuration Firebase du navigateur se trouve dans `firebase-config.js`. Les règles Firestore et Storage doivent exiger l’authentification du compte atelier autorisé avant l’accès aux données professionnelles.

WheelerBrothers Carnet utilise des collections séparées et une authentification par numéro de téléphone. Les invitations sont créées depuis le Carnet d’atelier et sont valables 24 heures.

## CORS Firebase Storage

Le fichier `cors.json` conserve la configuration CORS utilisée pour les photos des rapports. Il peut être appliqué au bucket Firebase Storage avec les outils Google Cloud lorsque cela est nécessaire.

Origine autorisée :

```text
https://tdyfa.github.io
```

Méthodes utilisées : `GET` et `HEAD`.

## Installation sur iPhone

Ouvrir WheelerBrothers dans Safari, puis utiliser **Partager → Sur l’écran d’accueil**. Le nom, l’icône et le cache de la PWA sont définis par `manifest.json`, `apple-touch-icon.png` et `sw.js`.

## Précautions

- Ne jamais placer le mot de passe du compte atelier dans les fichiers publics.
- Ne pas remplacer les règles Firebase finales par d’anciennes règles permissives.
- Toujours sauvegarder les règles actives avant une modification.
- Vérifier le chargement de Carnet, Rapport et Inventaire après chaque mise à jour importante.
