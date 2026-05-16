#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace CasaDaBee.EditorTools
{
    public static class CasaDaBeeAndroidExporter
    {
        private const string ScenePath = "Assets/CasaDaBee/Scenes/CasaDaBeePrototype.unity";

        [MenuItem("Casa da Bee/Export Android unityLibrary")]
        public static void ExportAndroidLibrary()
        {
            var exportPath = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../mobile/android/unity-export"));
            Directory.CreateDirectory(exportPath);

            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;

            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = exportPath,
                target = BuildTarget.Android,
                options = BuildOptions.ExportAsGoogleAndroidProject,
            };

            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new BuildFailedException("Casa da Bee Android export failed: " + report.summary.result);
            }

            Debug.Log("Casa da Bee Android export ready at: " + exportPath);
        }
    }
}
#endif
