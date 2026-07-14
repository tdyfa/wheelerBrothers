# Autoriser l'intégration des photos Firebase dans les PDF

Cette opération est à effectuer **une seule fois** sur le bucket Firebase Storage.

L'envoi des photos et leur affichage dans une balise `<img>` peuvent fonctionner sans cette étape. En revanche, pour dessiner une photo dans le canvas qui compose le PDF, le navigateur doit être autorisé à lire ses octets grâce à CORS.

## Méthode simple avec Google Cloud Shell

1. Ouvre la console Google Cloud avec le projet **wheelerbrothers**.
2. Clique sur l'icône **Activer Cloud Shell** en haut à droite.
3. Copie-colle le bloc suivant dans le terminal :

```bash
cat > cors.json <<'JSON'
[
  {
    "origin": ["https://tdyfa.github.io"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "ETag", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
JSON

gcloud storage buckets update gs://wheelerbrothers.firebasestorage.app --cors-file=cors.json
```

4. Attends environ une minute.
5. Ferme puis rouvre Wheeler Brothers et relance **Générer le PDF**.

## Vérification facultative

Dans Cloud Shell :

```bash
gcloud storage buckets describe gs://wheelerbrothers.firebasestorage.app --format="default(cors_config)"
```

La sortie doit mentionner l'origine `https://tdyfa.github.io` et les méthodes `GET` et `HEAD`.

## Si le bucket indiqué n'existe pas

Dans Firebase Console > Storage, copie le nom exact du bucket affiché en haut, puis remplace :

```text
gs://wheelerbrothers.firebasestorage.app
```

par ce nom exact dans les deux commandes.

Cette configuration n'ouvre pas les fichiers à tout le monde : les règles Firebase Storage et les URL de téléchargement continuent de contrôler l'accès. Elle autorise seulement l'application Wheeler Brothers hébergée sur GitHub Pages à lire les réponses de téléchargement dans le navigateur.
