/**
 * Copyright 2019, Optimizely
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Get Experiment Ids which are part of rollouts
function getRolloutExperimentIds(rollouts) {
  return rollouts.reduce(function(experimentIds, rollout) {
    rollout.experiments.forEach(function(e) {
      experimentIds[e.id] = true;
    });
    return experimentIds;
  }, {});
}

// Gets Map of all experiments except rollouts
function getExperimentsMap(configObj) {
  var rolloutExperimentIds = getRolloutExperimentIds(configObj.rollouts);
  var featureVariablesMap = configObj.featureFlags.reduce(function(resultMap, feature){
    resultMap[feature.id] = feature.variables;
    return resultMap;
  }, {});
  return configObj.experiments.reduce(function(experiments, experiment) {
    // skip experiments that are part of a rollout
    if (!rolloutExperimentIds[experiment.id]) {
      experiments[experiment.key] = {
        id: experiment.id,
        key: experiment.key,
        variationsMap: experiment.variations.reduce(function(variations, variation) {
          var variablesMap = {};
          if (variation.featureEnabled) {
            variablesMap = variation.variables.reduce(function(variables, variable) {
              // developing a temporary map using variable ids. the entry with ids will be deleted after merging with featurevaribles
              variables[variable.id] = {
                id: variable.id,
                value: variable.value,
              };
              return variables;
            }, {});
          }
          variations[variation.key] = {
            id: variation.id,
            key: variation.key,
            featureEnabled: variation.featureEnabled,
            variablesMap,
          };
          return variations;
        }, {}),
      };
      var featureId = configObj.experimentFeatureMap[experiment.id];
      if (featureId) {
        mergeFeatureVariables(experiments[experiment.key], featureVariablesMap[featureId]);
      }
    }
    return experiments;
  }, {});
}

// Merges feature varibles in variations of passed in experiment
// Modifies experiment object.
function mergeFeatureVariables(experiment, featureVariables) {
  var variationKeys = Object.keys(experiment.variationsMap);
  variationKeys.forEach(function(variationKey) {
    var variation = experiment.variationsMap[variationKey];
    featureVariables.forEach(function(featureVariable) {
      var variationVariable = variation.variablesMap[featureVariable.id];
      var variableValue = variationVariable ? variationVariable.value : featureVariable.defaultValue;
      variation.variablesMap[featureVariable.key] = {
        id: featureVariable.id,
        key: featureVariable.key,
        type: featureVariable.type,
        value: variableValue,
      };
      // deleting the temporary entry
      variationVariable && delete variation.variablesMap[featureVariable.id];
    })
  });
};

// Gets map of all experiments
function getFeaturesMap(configObj, allExperiments) {
  return configObj.featureFlags.reduce(function(features, feature) {
    features[feature.key] = {
      id: feature.id,
      key: feature.key,
      experimentsMap: feature.experimentIds.reduce(function(experiments, experimentId) {
        var experimentKey = configObj.experimentIdMap[experimentId].key;
        experiments[experimentKey] = allExperiments[experimentKey];
        return experiments;
      }, {}),
      variablesMap: feature.variables.reduce(function(variables, variable) {
        variables[variable.key] = {
          id: variable.id,
          key: variable.key,
          type: variable.type,
          value: variable.defaultValue,
        }
        return variables;
      }, {}),
    };
    return features;
  }, {});
}

module.exports = {
  getOptimizelyConfig: function(configObj) {
    // Fetch all feature variables from feature flags to merge them with variation variables
    var experimentsMap = getExperimentsMap(configObj);
    return {
      experimentsMap,
      featuresMap: getFeaturesMap(configObj, experimentsMap),
      revision: configObj.revision,
    }
  },
};