using UnityEngine;

namespace CasaDaBee
{
    public class BeeAgentController : MonoBehaviour
    {
        public float moveSpeed = 2.2f;
        public Transform speechAnchor;
        public string currentState = BeeStates.Idle;

        private Vector3 targetPosition;
        private bool hasMoveTarget;
        private SpriteRenderer body;
        private SpriteRenderer leftWing;
        private SpriteRenderer rightWing;
        private SpriteRenderer cheek;

        public void Initialize()
        {
            targetPosition = transform.position;
            BuildVisual();
        }

        public void MoveTo(Vector3 target)
        {
            target.z = transform.position.z;
            targetPosition = target;
            hasMoveTarget = true;
            SetState(BeeStates.Walking);
        }

        public void SetState(string state)
        {
            if (string.IsNullOrEmpty(state)) state = BeeStates.Idle;
            currentState = state;

            if (body == null) return;

            if (state == BeeStates.Happy || state == BeeStates.Celebrating)
            {
                body.color = new Color(1f, 0.88f, 0.18f);
                cheek.enabled = true;
            }
            else if (state == BeeStates.Confused)
            {
                body.color = new Color(1f, 0.67f, 0.22f);
                cheek.enabled = false;
            }
            else if (state == BeeStates.Tired || state == BeeStates.Sleeping)
            {
                body.color = new Color(0.82f, 0.76f, 0.58f);
                cheek.enabled = false;
            }
            else
            {
                body.color = new Color(1f, 0.82f, 0.12f);
                cheek.enabled = state == BeeStates.Speaking;
            }
        }

        private void Update()
        {
            AnimateWings();

            if (!hasMoveTarget) return;

            transform.position = Vector3.MoveTowards(transform.position, targetPosition, moveSpeed * Time.deltaTime);
            if (Vector3.Distance(transform.position, targetPosition) < 0.03f)
            {
                hasMoveTarget = false;
                if (currentState == BeeStates.Walking) SetState(BeeStates.Idle);
            }
        }

        private void AnimateWings()
        {
            if (leftWing == null || rightWing == null) return;
            var beat = Mathf.Sin(Time.time * 22f) * 15f;
            leftWing.transform.localRotation = Quaternion.Euler(0f, 0f, 24f + beat);
            rightWing.transform.localRotation = Quaternion.Euler(0f, 0f, -24f - beat);
            var wingScale = 0.52f + Mathf.Abs(Mathf.Sin(Time.time * 18f)) * 0.08f;
            leftWing.transform.localScale = new Vector3(0.52f, wingScale, 1f);
            rightWing.transform.localScale = new Vector3(0.52f, wingScale, 1f);
        }

        private void BuildVisual()
        {
            var shadowSprite = SpriteFactory.Circle("bee-shadow", 64, new Color(0f, 0f, 0f, 0.14f), new Color(0f, 0f, 0f, 0f), 0f);
            var wingSprite = SpriteFactory.Circle("bee-wing", 64, new Color(0.78f, 0.94f, 1f, 0.56f), new Color(0.31f, 0.53f, 0.75f, 0.26f), 2f);
            var bodySprite = SpriteFactory.Circle("bee-body", 96, new Color(1f, 0.82f, 0.12f), new Color(0.25f, 0.19f, 0.08f), 3f);
            var stripeSprite = SpriteFactory.Rect("bee-stripe", 80, 12, new Color(0.22f, 0.18f, 0.12f), new Color(0.22f, 0.18f, 0.12f), 1);
            var eyeSprite = SpriteFactory.Circle("bee-eye", 32, new Color(0.07f, 0.06f, 0.04f), new Color(0.07f, 0.06f, 0.04f), 1f);
            var cheekSprite = SpriteFactory.Circle("bee-cheek", 28, new Color(1f, 0.42f, 0.48f, 0.62f), new Color(1f, 0.42f, 0.48f, 0f), 0f);

            CreatePart("Shadow", shadowSprite, new Vector3(0f, -0.44f, 0.03f), new Vector3(0.86f, 0.26f, 1f), 5);
            leftWing = CreatePart("Left Wing", wingSprite, new Vector3(-0.34f, 0.14f, 0.02f), new Vector3(0.52f, 0.58f, 1f), 9);
            rightWing = CreatePart("Right Wing", wingSprite, new Vector3(0.34f, 0.14f, 0.02f), new Vector3(0.52f, 0.58f, 1f), 9);
            body = CreatePart("Body", bodySprite, Vector3.zero, new Vector3(0.62f, 0.78f, 1f), 20);

            CreatePart("Stripe A", stripeSprite, new Vector3(0f, 0.12f, -0.01f), new Vector3(0.58f, 0.34f, 1f), 25);
            CreatePart("Stripe B", stripeSprite, new Vector3(0f, -0.12f, -0.01f), new Vector3(0.54f, 0.34f, 1f), 25);
            CreatePart("Left Eye", eyeSprite, new Vector3(-0.16f, 0.2f, -0.02f), new Vector3(0.16f, 0.2f, 1f), 30);
            CreatePart("Right Eye", eyeSprite, new Vector3(0.16f, 0.2f, -0.02f), new Vector3(0.16f, 0.2f, 1f), 30);
            cheek = CreatePart("Cheek", cheekSprite, new Vector3(0f, -0.02f, -0.02f), new Vector3(0.18f, 0.12f, 1f), 31);
            cheek.enabled = false;

            var anchorObject = new GameObject("Speech Anchor");
            anchorObject.transform.SetParent(transform, false);
            anchorObject.transform.localPosition = new Vector3(0f, 0.66f, 0f);
            speechAnchor = anchorObject.transform;

            var collider = gameObject.AddComponent<CircleCollider2D>();
            collider.radius = 0.45f;
        }

        private SpriteRenderer CreatePart(string partName, Sprite sprite, Vector3 localPosition, Vector3 localScale, int sortingOrder)
        {
            var part = new GameObject(partName);
            part.transform.SetParent(transform, false);
            part.transform.localPosition = localPosition;
            part.transform.localScale = localScale;
            var renderer = part.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            renderer.sortingOrder = sortingOrder;
            return renderer;
        }
    }
}
