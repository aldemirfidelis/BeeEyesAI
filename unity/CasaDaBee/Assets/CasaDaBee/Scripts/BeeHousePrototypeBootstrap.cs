using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CasaDaBee
{
    public class BeeHousePrototypeBootstrap : MonoBehaviour
    {
        private Camera worldCamera;
        private IsoGridController grid;
        private BeeAgentController bee;
        private SpeechBubbleController speechBubble;
        private BeeHouseBridge bridge;

        private readonly List<FurnitureStation> stations = new List<FurnitureStation>();

        private void Start()
        {
            SetupCamera();
            SetupEventSystem();
            BuildRoom();
            BuildBee();
            BuildBridge();
            BuildToolbar();
            speechBubble.Show("Bem-vindo a Casa da Bee!");
        }

        private void Update()
        {
            if (bee == null || worldCamera == null) return;

            if (Input.touchCount > 0)
            {
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Began && !IsPointerOverUi(touch.fingerId))
                {
                    MoveBeeToScreen(touch.position);
                }
            }
            else if (Input.GetMouseButtonDown(0) && !IsPointerOverUi())
            {
                MoveBeeToScreen(Input.mousePosition);
            }
        }

        private void SetupCamera()
        {
            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            worldCamera = cameraObject.AddComponent<Camera>();
            worldCamera.orthographic = true;
            worldCamera.orthographicSize = 4.4f;
            worldCamera.backgroundColor = new Color(1f, 0.94f, 0.74f);
            worldCamera.clearFlags = CameraClearFlags.SolidColor;
            cameraObject.transform.position = new Vector3(0f, -2.65f, -10f);
        }

        private static void SetupEventSystem()
        {
            if (EventSystem.current != null) return;
            var eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<EventSystem>();
            eventSystem.AddComponent<StandaloneInputModule>();
        }

        private void BuildRoom()
        {
            var gridObject = new GameObject("Isometric Honey Room");
            grid = gridObject.AddComponent<IsoGridController>();
            grid.width = 8;
            grid.height = 8;
            grid.Build();

            CreateFurniture("Mesa de Mel", "desk", 2, 2, new Color(0.72f, 0.42f, 0.16f), new Vector2(1.35f, 0.72f));
            CreateFurniture("Notebook", "computer", 2, 1, new Color(0.18f, 0.23f, 0.33f), new Vector2(0.62f, 0.4f));
            CreateFurniture("Biblioteca", "library", 5, 1, new Color(0.42f, 0.22f, 0.14f), new Vector2(1.35f, 1.05f));
            CreateFurniture("Calendario", "calendar", 6, 3, new Color(0.28f, 0.53f, 0.86f), new Vector2(0.78f, 0.78f));
            CreateFurniture("Fitness", "fitness", 4, 5, new Color(0.18f, 0.65f, 0.45f), new Vector2(1.38f, 0.52f));
            CreateFurniture("Cama", "bed", 1, 5, new Color(0.9f, 0.45f, 0.48f), new Vector2(1.42f, 0.86f));
            CreateFurniture("Loja", "shop", 6, 6, new Color(0.65f, 0.42f, 0.86f), new Vector2(1.18f, 0.72f));
        }

        private void BuildBee()
        {
            var beeObject = new GameObject("Bee");
            beeObject.transform.position = grid.GridToWorld(4, 4, -0.1f) + new Vector3(0f, 0.25f, 0f);
            bee = beeObject.AddComponent<BeeAgentController>();
            bee.Initialize();

            var bubbleObject = new GameObject("Speech Bubble");
            speechBubble = bubbleObject.AddComponent<SpeechBubbleController>();
            speechBubble.Initialize(bee.speechAnchor);
        }

        private void BuildBridge()
        {
            var bridgeObject = new GameObject("BeeHouseBridge");
            bridge = bridgeObject.AddComponent<BeeHouseBridge>();
            bridge.bee = bee;
            bridge.speechBubble = speechBubble;
            bridge.stations = stations;
        }

        private void BuildToolbar()
        {
            var canvasObject = new GameObject("Prototype Toolbar");
            var canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasObject.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasObject.AddComponent<GraphicRaycaster>();

            var panel = new GameObject("Panel");
            panel.transform.SetParent(canvasObject.transform, false);
            var panelRect = panel.AddComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0f, 0f);
            panelRect.anchorMax = new Vector2(1f, 0f);
            panelRect.pivot = new Vector2(0.5f, 0f);
            panelRect.anchoredPosition = new Vector2(0f, 18f);
            panelRect.sizeDelta = new Vector2(-28f, 62f);
            var layout = panel.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = 8f;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = true;

            AddToolbarButton(panel.transform, "Pesquisa", () => bridge.SimulateTask("research"));
            AddToolbarButton(panel.transform, "Treino", () => bridge.SimulateTask("fitness"));
            AddToolbarButton(panel.transform, "Agenda", () => bridge.SimulateTask("calendar"));
            AddToolbarButton(panel.transform, "Concluir", () => bridge.ApplyTask(new BeeHouseTaskMessage
            {
                taskType = "general",
                status = "completed",
                beeState = BeeStates.Happy,
                speechText = "Prontinho, encontrei!"
            }));
            AddToolbarButton(panel.transform, "Erro", () => bridge.ApplyTask(new BeeHouseTaskMessage
            {
                taskType = "general",
                status = "failed",
                beeState = BeeStates.Confused,
                speechText = "Ops, tive dificuldade aqui."
            }));
        }

        private FurnitureStation CreateFurniture(string label, string stationKey, int gridX, int gridY, Color color, Vector2 size)
        {
            var furniture = new GameObject(label);
            furniture.transform.position = grid.GridToWorld(gridX, gridY, -0.05f) + new Vector3(0f, 0.25f, 0f);
            var renderer = furniture.AddComponent<SpriteRenderer>();
            renderer.sprite = SpriteFactory.Rect(label + "-sprite", 96, 64, color, new Color(0.18f, 0.13f, 0.08f), 4);
            renderer.sortingOrder = 80 + gridY;
            furniture.transform.localScale = new Vector3(size.x, size.y, 1f);

            var station = furniture.AddComponent<FurnitureStation>();
            station.stationKey = stationKey;
            var anchor = new GameObject("Bee Anchor");
            anchor.transform.SetParent(furniture.transform, false);
            anchor.transform.localPosition = new Vector3(0f, -0.68f / Mathf.Max(size.y, 0.1f), 0f);
            station.beeAnchor = anchor.transform;
            stations.Add(station);

            var textObject = new GameObject("Label");
            textObject.transform.SetParent(furniture.transform, false);
            textObject.transform.localPosition = new Vector3(0f, 0.62f / Mathf.Max(size.y, 0.1f), -0.02f);
            var text = textObject.AddComponent<TextMesh>();
            text.text = label;
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.fontSize = 26;
            text.characterSize = 0.03f;
            text.color = new Color(0.12f, 0.09f, 0.05f);
            textObject.GetComponent<MeshRenderer>().sortingOrder = 150 + gridY;

            return station;
        }

        private static void AddToolbarButton(Transform parent, string label, UnityEngine.Events.UnityAction action)
        {
            var buttonObject = new GameObject(label + " Button");
            buttonObject.transform.SetParent(parent, false);
            var image = buttonObject.AddComponent<Image>();
            image.color = new Color(1f, 0.84f, 0.18f, 0.94f);

            var button = buttonObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(action);

            var textObject = new GameObject("Text");
            textObject.transform.SetParent(buttonObject.transform, false);
            var textRect = textObject.AddComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            var text = textObject.AddComponent<Text>();
            text.text = label;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = new Color(0.1f, 0.08f, 0.04f);
            text.fontSize = 18;
            text.fontStyle = FontStyle.Bold;
        }

        private void MoveBeeToScreen(Vector2 screenPosition)
        {
            var world = worldCamera.ScreenToWorldPoint(new Vector3(screenPosition.x, screenPosition.y, Mathf.Abs(worldCamera.transform.position.z)));
            world.z = -0.1f;
            bee.MoveTo(world);
            speechBubble.Show("Vou ali!");
        }

        private static bool IsPointerOverUi(int fingerId = -1)
        {
            if (EventSystem.current == null) return false;
            return fingerId >= 0
                ? EventSystem.current.IsPointerOverGameObject(fingerId)
                : EventSystem.current.IsPointerOverGameObject();
        }
    }
}
