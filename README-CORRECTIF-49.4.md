# WheelerBrothers 49.4 — correctif de chargement

Cette version corrige :

- le SDK Firebase Authentication manquant sur l’accueil, le générateur et l’inventaire ;
- le chargement des modules avant la récupération du véritable `spaceId` privé ;
- le bouton « Changer le code d’atelier » qui appelait une ancienne fonction supprimée ;
- le bouton « Forcer la mise à jour » qui ne recevait plus son gestionnaire à cause de cette erreur JavaScript.

Les données Firestore ne sont ni déplacées ni effacées.
