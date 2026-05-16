#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace CasaDaBee.EditorTools
{
    public static class CasaDaBeeSceneCreator
    {
        private const string ScenePath = "Assets/CasaDaBee/Scenes/CasaDaBeePrototype.unity";

        [MenuItem("Casa da Bee/Recreate Prototype Scene")]
        public static void RecreatePrototypeScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("CasaDaBeePrototype");
            root.AddComponent<global::CasaDaBee.BeeHousePrototypeBootstrap>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
        }
    }
}
#endif
