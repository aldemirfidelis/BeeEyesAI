using UnityEngine;

namespace CasaDaBee
{
    public class SpeechBubbleController : MonoBehaviour
    {
        public Transform target;
        public Vector3 offset = new Vector3(0f, 1.05f, 0f);
        public float defaultSeconds = 3.4f;

        private SpriteRenderer background;
        private TextMesh textMesh;
        private float hideAt;

        public void Initialize(Transform followTarget)
        {
            target = followTarget;

            background = gameObject.AddComponent<SpriteRenderer>();
            background.sprite = SpriteFactory.Rect("speech-bubble", 180, 72, new Color(1f, 0.98f, 0.86f), new Color(0.27f, 0.22f, 0.13f), 4);
            background.sortingOrder = 500;

            var textObject = new GameObject("Text");
            textObject.transform.SetParent(transform, false);
            textObject.transform.localPosition = new Vector3(0f, 0.01f, -0.01f);
            textMesh = textObject.AddComponent<TextMesh>();
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.alignment = TextAlignment.Center;
            textMesh.color = new Color(0.13f, 0.11f, 0.08f);
            textMesh.fontSize = 38;
            textMesh.characterSize = 0.026f;
            textMesh.richText = false;
            textObject.GetComponent<MeshRenderer>().sortingOrder = 501;

            gameObject.SetActive(false);
        }

        public void Show(string message, float seconds = -1f)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            var wrapped = Wrap(message.Trim(), 28);
            textMesh.text = wrapped;
            var maxLine = 1;
            foreach (var line in wrapped.Split('\n'))
            {
                if (line.Length > maxLine) maxLine = line.Length;
            }

            var width = Mathf.Clamp(1.25f + maxLine * 0.028f, 1.6f, 3.2f);
            var height = Mathf.Clamp(0.48f + wrapped.Split('\n').Length * 0.24f, 0.62f, 1.35f);
            background.transform.localScale = new Vector3(width, height, 1f);

            hideAt = Time.time + (seconds > 0f ? seconds : defaultSeconds);
            gameObject.SetActive(true);
        }

        private void LateUpdate()
        {
            if (target != null)
            {
                transform.position = target.position + offset;
            }

            if (gameObject.activeSelf && Time.time > hideAt)
            {
                gameObject.SetActive(false);
            }
        }

        private static string Wrap(string input, int maxLineLength)
        {
            var words = input.Split(' ');
            var output = "";
            var lineLength = 0;
            foreach (var word in words)
            {
                if (lineLength > 0 && lineLength + word.Length + 1 > maxLineLength)
                {
                    output += "\n";
                    lineLength = 0;
                }
                else if (lineLength > 0)
                {
                    output += " ";
                    lineLength += 1;
                }

                output += word;
                lineLength += word.Length;
            }

            return output;
        }
    }
}
