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
