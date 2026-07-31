<!--
HISTORIQUE DES VERSIONS

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

# WheelerBrothers Atelier — version 51

Application comprenant le Carnet d’atelier, le Générateur de rapports, l’Inventaire et le partage sécurisé vers WheelerBrothers Carnet.

## Rapports accessibles dans WB Carnet

Lorsqu’une opération provient du Générateur de rapport et que le véhicule est partagé :

- l’opération synchronisée contient l’identifiant du rapport ;
- le document source du rapport est marqué pour le véhicule WB Carnet concerné ;
- les sauvegardes suivantes conservent ce marquage ;
- aucun fichier PDF n’est envoyé dans Firebase Storage.

Le PDF est généré à la demande sur l’appareil du proche à partir du rapport Firestore et des photos déjà présentes dans Storage.

## Déploiement

Placer tous les fichiers à la racine du dépôt GitHub Pages `wheelerBrothers`.

Publier ensuite les règles Firestore et Storage fournies dans le dossier Firebase du paquet complet.
