<!--
HISTORIQUE DES VERSIONS

v50
- Ajout de deux actions distinctes pour les accès WB Carnet : retrait d’une fiche et désactivation globale du compte.
- La désactivation globale retire tous les véhicules du compte et bloque toute création de fiche ou d’opération.
- Une nouvelle invitation WheelerBrothers peut réactiver ultérieurement le compte, uniquement sur le véhicule invité.

v49.10
- Alignement de « MàJ Carnet » et centrage des boutons Exporter/Importer.
- Regroupement de la documentation dans un fichier unique.

v49.9
- Bandeaux noirs dans le Carnet d’atelier et le Générateur de rapport.

v49.8
- En-têtes homogènes entre les outils.

v49.7
- Ajout du statut Firebase.

v49.6
- Correction du chargement du Carnet d’atelier.

v49
- Authentification Firebase du compte atelier unique.
- Intégration du partage vers WheelerBrothers Carnet.
-->

# WheelerBrothers Atelier

Application comprenant le Carnet d’atelier, le Générateur de rapports, l’Inventaire et le partage sécurisé vers WheelerBrothers Carnet.

## Accès WB Carnet

Pour chaque numéro actif, deux actions sont disponibles :

- **Retirer cette fiche** : retire uniquement le véhicule actuellement ouvert ;
- **Désactiver le compte** : bloque entièrement WB Carnet pour ce numéro et retire tous ses accès aux véhicules.

Une nouvelle invitation créée depuis WheelerBrothers peut réactiver un compte désactivé. Elle ne restaure pas automatiquement les anciens véhicules : seul le véhicule de la nouvelle invitation est attribué.

## Déploiement

Placer tous les fichiers à la racine du dépôt GitHub Pages `wheelerBrothers`, puis publier les règles Firestore fournies séparément avec cette version.

## Authentification

WheelerBrothers utilise le compte Firebase Authentication unique de l’atelier. L’ancien identifiant d’espace reste utilisé en arrière-plan pour les données présentes sous `/spaces/...`.
