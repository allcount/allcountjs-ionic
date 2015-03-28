var allcountMobileModule = angular.module("allcount-mobile", ["allcount-base", "ionic"]);

allcountMobileModule.config(["$httpProvider", function ($httpProvider) {
    $httpProvider.interceptors.push(['lcApiConfig', '$q', function(lcApiConfig, $q) {
        return {
            request: function(config) {
                if (lcApiConfig.serverUrl && config.url.indexOf('/api') !== -1) { //TODO narrow scope of affected queries
                    config.url = lcApiConfig.serverUrl + config.url;
                }
                if (localStorage.allcountToken) {
                    config.headers = config.headers || {};
                    config.headers['X-Access-Token'] = localStorage.allcountToken;
                }
                return config;
            },
            responseError: function (error) {
                if (error.status === 403 && error.data === "Not authenticated") { //TODO check response
                    lcApiConfig.authenticateFailedListener && lcApiConfig.authenticateFailedListener();
                }
                return $q.reject(error);
            }
        };
    }]);
}]);

allcountMobileModule.config(["$stateProvider", function ($stateProvider) {
    $stateProvider.setupStandardAllcountMainState = function (stateName, templatePath, stateUrl) {
        return this
            .state(stateName, {
                url: stateUrl || '/app',
                abstract: true,
                templateUrl: templatePath + "/menu.html",
                controller: 'MenuController',
                resolve: {
                    templatePath: function () {
                        return templatePath;
                    }
                }
            });
    };
    $stateProvider.setupStandardAllcountStates = function (statePrefix, templatePath) {
        return this
            .state(statePrefix + '.main', {
                url: "/main",
                views: {
                    'menuContent': {
                        templateUrl: templatePath + "/main.html",
                        controller: 'MainScreenController'
                    }
                }
            })
            .state(statePrefix + '.entity', {
                url: "/entity/:entityTypeId",
                views: {
                    'menuContent': {
                        templateUrl: templatePath + "/entity.html",
                        controller: 'EntityController'
                    }
                }
            })
            .state(statePrefix + '.entityCreateForm', {
                url: "/entity/:entityTypeId/new",
                views: {
                    'menuContent': {
                        templateUrl: templatePath + "/entity-form-create.html",
                        controller: 'EntityFormCreateController'
                    }
                }
            })
            .state(statePrefix + '.entityForm', {
                url: "/entity/:entityTypeId/:entityId",
                views: {
                    'menuContent': {
                        templateUrl: templatePath + "/entity-form.html",
                        controller: 'EntityFormController'
                    }
                }
            })
            .state(statePrefix + '.entityFormField', {
                url: "/entity/:entityTypeId/:entityId/:field",
                views: {
                    'menuContent': {
                        templateUrl: templatePath + "/entity-form-field.html",
                        controller: 'EntityFormFieldController'
                    }
                }
            });
    }
}]);

allcountBaseModule.factory("lcApiConfig", function () {
    return {
        setServerUrl: function (serverUrl) {
            this.serverUrl = serverUrl;
        },
        setAuthenticateFailedListener: function (listener) {
            this.authenticateFailedListener = listener;
        }
    }
});


//TODO make configurable
allcountMobileModule.config(["fieldRenderingServiceProvider", function (fieldRenderingServiceProvider) {
    fieldRenderingServiceProvider.defineFields(["$filter", "$compile", "$locale", "lcApi", "messages", function ($filter, $compile, $locale, rest, messages) {

        var dateRegex = /^(\d{4})-(\d\d)-(\d\d)$/;

        function textareaRenderer(value) {
            var elem = $('<span></span>');
            var escapedText = elem.text(value).html();
            elem.addClass("textarea-field-paragraph");
            const escapedHtml = escapedText.split("\n").join('<br>');
            elem.html(escapedHtml);
            return elem;
        }

        function parseDate(s) {
            if (!s) return undefined;
            var match;
            if (match = s.match(dateRegex)) {
                var date = new Date(0);
                date.setFullYear(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
                return date;
            }
            return undefined;
        }

        function wireTextInputWithController(input, controller, updateValue) {
            input.val(controller.$viewValue);
            input.on('input', function () {
                var value = $.trim($(this).val());
                updateValue(value.length > 0 ? value : undefined);
            });
            return input;
        }

        function wrapWithItemLabel(elem) {
            var label = $('<label class="item item-input"></label>');
            label.append(elem);
            return label;
        }

        function notSupportedEditor () {
            var elem = $('<div class="item"></div>');
            elem.text(messages("Editing not supported"));
            return elem;
        }

        function textInput(controller, updateValue) {
            var input = $('<input type="text"/>');
            return wrapWithItemLabel(wireTextInputWithController(input, controller, updateValue));
        }

        function textareaInput(controller, updateValue) {
            var input = $('<textarea class="item-node"/>');
            return wrapWithItemLabel(wireTextInputWithController(input, controller, updateValue));
        }

        function maskedInput(controller, updateValue, mask) {
            var input = $('<input type="text" class="item-node"/>');
            $(input).inputmask(mask);
            input.val(controller.$viewValue);
            function listener() {
                var value = $.trim($(this).val());
                updateValue(value.length > 0 && $(input).inputmask("isComplete") ? value : undefined);
            }
            input.on('input', listener);
            input.on('cleared', listener);
            input.change(listener); //TODO triggers on blur but not always before save
            return wrapWithItemLabel(input);
        }

        var currencyConfig = { //TODO
            'alias': 'numeric',
            'radixPoint': $locale.NUMBER_FORMATS.DECIMAL_SEP,
            'groupSeparator': $locale.NUMBER_FORMATS.GROUP_SEP,
            'autoGroup': true,
            'digits': 2, //$locale.NUMBER_FORMATS.PATTERNS[1].maxFrac, //TODO could be other than 2?
            'digitsOptional': false,
            'placeholder': '0'
        };

        function renderCurrency(viewValue) {
            return viewValue && $.inputmask.format(viewValue.slice(0, viewValue.length - 2) + currencyConfig.radixPoint + viewValue.slice(viewValue.length - 2), currencyConfig) || undefined;
        }

        return {
            text: [function (value, fieldDescription) {
                return fieldDescription.fieldType.isMultiline ? textareaRenderer(value) : value;
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                if (fieldDescription.fieldType.isMultiline) {
                    return textareaInput(controller, updateValue);
                } else if (fieldDescription.fieldType.mask) {
                    return maskedInput(controller, updateValue, fieldDescription.fieldType.mask);
                } else {
                    return textInput(controller, updateValue)
                }
            }],
            date: [function (value) {
                return $filter('date')(value);
            }, function (fieldDescription, controller, updateValue, clone, scope) { //TODO
                var input = $('<input type="date" ng-model="value">');
                scope.value = parseDate(controller.$viewValue);
                scope.$watch('value', function (value) {
                    controller.$setViewValue(value ? $filter('date')(value, 'yyyy-MM-dd') : undefined);
                });
                return wrapWithItemLabel($compile(input)(scope));
            }],
            integer: [function (value) {
                return value + "";
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                scope.integerValue = controller.$viewValue;
                scope.pattern = /\d+/;
                scope.$watch('integerValue', function (integerValue) {
                    controller.$setViewValue(integerValue);
                });
                return wrapWithItemLabel($compile('<input type="number" ng-model="integerValue" class="item-node" ng-pattern="pattern">')(scope));
            }],
            money: [function (value) {
                return renderCurrency(value);
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                var input = $('<input type="text"/>');
                var viewValue = controller.$viewValue;
                viewValue = renderCurrency(viewValue);
                input.val(viewValue);
                input.on('input', function () {
                    var value = $.trim($(this).val()).replace(/[^0-9]/g, '');
                    updateValue(value.length > 0 ? value : undefined);
                });
                $(input).inputmask(currencyConfig);
                return wrapWithItemLabel(input);
            }],
            checkbox: [function (value) {
                return value ? messages("Yes") : messages("No");
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                scope.checkboxValue = controller.$viewValue;
                scope.name = fieldDescription.name;
                scope.$watch('checkboxValue', function (checkboxValue) {
                    controller.$setViewValue(checkboxValue);
                });
                return $compile('<div class="item item-toggle">{{name}}<label class="toggle"><input type="checkbox" ng-model="checkboxValue"><div class="track"><div class="handle"></div></div></label></div>')(scope);
            }],
            reference: [function (value) {
                return value ? value.name : undefined;
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                if (fieldDescription.fieldType.render === 'fixed') {
                    rest.referenceValues(fieldDescription.fieldType.referenceEntityTypeId, function (referenceValues) {
                        scope.referenceValues = referenceValues;
                        scope.referenceIdToValue = {};
                        $(scope.referenceValues).each(function (index, item) {
                            scope.referenceIdToValue[item.id] = item;
                        });
                        scope.$watch('model.selectedReferenceId', function (referenceValueId) {
                            controller.$setViewValue(referenceValueId ? scope.referenceIdToValue[referenceValueId] : undefined);
                        });
                    });
                    scope.model = {selectedReferenceId: controller.$viewValue ? controller.$viewValue.id : undefined};
                    return $compile('<div><label class="item item-radio" ng-repeat="r in referenceValues"><input type="radio" ng-model="model.selectedReferenceId" ng-value="r.id"><div class="item-content">{{r.name}}&nbsp;</div><i class="radio-icon ion-checkmark"></i></label></div>')(scope);
                } else {
                    scope.referenceEntityTypeId = fieldDescription.fieldType.referenceEntityTypeId;

                    scope.$watch('selectedReference.value', function (referenceValue) {
                        controller.$setViewValue(referenceValue);
                    });
                    scope.selectedReference = {value: controller.$viewValue};

                    return $compile('<div ng-model="selectedReference.value" lc-reference="referenceEntityTypeId"></div>')(scope);

                }
            }],
            password: [function (value) {
                return '';
            }, function (fieldDescription, controller, updateValue, clone, scope) { //TODO doubling
                var input = $('<input type="password"/>');
                input.val(controller.$viewValue);
                input.on('input', function () {
                    var value = $.trim($(this).val());
                    updateValue(value.length > 0 ? value : undefined);
                });
                return wrapWithItemLabel(input);
            }],
            relation: [function () { return '' }, function (fieldDescription, controller, updateValue, clone, scope) {
                return notSupportedEditor();
            }],
            attachment: [function (value) {
                if (!value) {
                    return undefined;
                }
                var elem = $('<a></a>');
                elem.attr('href', '/api/file/download/' + value.fileId);
                elem.text(value.name);
                return  elem;
            }, function (fieldDescription, controller, updateValue, clone, scope) {
                return notSupportedEditor();
            }]
        }
    }]);

    fieldRenderingServiceProvider.defineLayoutRenderers(function () { return {
        H: function (params, children) {
            var container = $('<div class="row"/>');
            var fraction = Math.floor(12.0 / children.length);
            $(children).each(function (index, item) {
                var elem = $('<div class="col-md-' + fraction +  '"/>');
                elem.append(item());
                container.append(elem);
            });
            return container;
        },
        V: function (params, children) {
            var container = $('<div class="row"/>');
            $(children).each(function (index, item) {
                var elem = $('<div class="col-md-12"/>');
                elem.append(item());
                container.append(elem);
            });
            return container;
        },
        Tabs: function (params, children, childrenObjs) {
            var container = $('<div/>');
            var tabContainer = $('<ul class="nav nav-tabs"/>');
            $(childrenObjs).each(function (index, item) {
                var elem = $('<li class="' + (index == 0 ? 'active' : '') +'"><a href="#tab-' + index +  '" data-toggle="tab">' + item.params.title + '</a></li>'); //TODO javascript injection? //TODO id generation
                tabContainer.append(elem);
            });
            container.append(tabContainer);

            var paneContainer = $('<div class="tab-content"/>');
            $(children).each(function (index, item) {
                var elem = $('<div class="tab-pane ' + (index == 0 ? 'active' : '') +'" id="tab-' + index +  '"></div>'); //TODO javascript injection? //TODO id generation
                elem.append(item());
                paneContainer.append(elem);
            });
            container.append(paneContainer);
            return container;
        }
    }});

    fieldRenderingServiceProvider.setFormStaticTemplate(["$compile", function ($compile) {
        return function (value, fieldScope) {
            var elem;
            if (value instanceof jQuery) {
                elem = $compile('<div class="item-note"></div>')(fieldScope);
                elem.append(value);
            } else {
                fieldScope.renderedText = value || '';
                elem = $compile('<div class="item-note">{{renderedText}}</div>')(fieldScope);
            }
            return elem;
        }
    }])
}]);

allcountMobileModule.factory('entityCreateService', [function () {
    var templates = {};
    return {
        entityTemplateFor: function (entityTypeId) {
            templates[entityTypeId] = templates[entityTypeId] || {$template: true};
            return templates[entityTypeId];
        },
        dropTemplateFor: function (entityTypeId) {
            delete templates[entityTypeId];
        }
    }
}]);

allcountMobileModule.controller('EntityController', function ($scope, $stateParams, $ionicHistory, lcApi) {
    $scope.viewState = {};
    $scope.mainEntityTypeId = $stateParams.entityTypeId;
    $scope.$on('$stateChangeSuccess',
        function(event, toState, toParams, fromState, fromParams){
            if ($ionicHistory.currentStateName() === toState.name && toParams.entityTypeId === $scope.mainEntityTypeId && $scope.viewState.gridMethods) {
                $scope.viewState.gridMethods.updateGrid();
            }
        }
    );
    $scope.loadNextItems = function () {
        $scope.viewState.gridMethods.infiniteScrollLoadNextItems().then(function () {
            $scope.$broadcast('scroll.infiniteScrollComplete');
        })
    };
    lcApi.entityDescription($scope.mainEntityTypeId).then(function (entityDescription) {
        $scope.title = entityDescription.title;
        $scope.referenceNameExpression = entityDescription.referenceNameExpression;
    });
});

allcountMobileModule.controller('EntityFormController', function ($scope, $stateParams, $rootScope, $ionicHistory, $ionicPopup, lcApi) {
    $scope.viewState = {};
    $scope.mainEntityTypeId = $stateParams.entityTypeId;
    $scope.entityId = $stateParams.entityId;

    $scope.$on('$stateChangeSuccess',
        function(event, toState, toParams, fromState, fromParams){
            if ($ionicHistory.currentStateName() === toState.name && toParams.entityId === $scope.entityId && toParams.entityTypeId === $scope.mainEntityTypeId && $scope.viewState.editForm) {
                $scope.viewState.editForm.reloadEntity();
            }
        }
    );

    $scope.deleteEntity = function () {
        var confirmPopup = $ionicPopup.confirm({
            title: 'Delete',
            template: 'Are you sure you want to delete it?'
        });
        confirmPopup.then(function(res) {
            if(res) {
                $scope.viewState.editForm.deleteEntity(function () {
                    $ionicHistory.goBack();
                });
            }
        });
    };

    lcApi.entityDescription($scope.mainEntityTypeId).then(function (entityDescription) {
        $scope.referenceNameExpression = entityDescription.referenceNameExpression;
    });
});

allcountMobileModule.controller('EntityFormCreateController', function ($scope, $stateParams, $rootScope, $ionicHistory, entityCreateService) {
    $scope.viewState = {};
    $scope.mainEntityTypeId = $stateParams.entityTypeId;
    $scope.template = entityCreateService.entityTemplateFor($stateParams.entityTypeId);
    $scope.entityId = 'new';
    $scope.createEntity = function () {
        $scope.viewState.editForm.createEntity(function () {
            $ionicHistory.goBack();
            entityCreateService.dropTemplateFor($stateParams.entityTypeId);
        });
    }
});

allcountMobileModule.controller('EntityFormFieldController', function ($scope, $stateParams, $rootScope, $ionicHistory, entityCreateService) {
    $scope.viewState = {};
    $scope.mainEntityTypeId = $stateParams.entityTypeId;
    if ($stateParams.entityId === 'new') {
        $scope.entity = entityCreateService.entityTemplateFor($stateParams.entityTypeId);
    } else {
        $scope.entityId = $stateParams.entityId;
    }
    $scope.field = $stateParams.field;
    $scope.saveEntity = function () {
        if ($stateParams.entityId === 'new') {
            $ionicHistory.goBack();
        } else {
            $scope.viewState.editForm.updateEntity(function () {
                $ionicHistory.goBack();
            });
        }
    };
});

allcountMobileModule.controller('MainScreenController', function ($scope, lcApi) {
    lcApi.appInfo().then(function (appInfo) {
        $scope.appInfo = appInfo;
    })
});

allcountMobileModule.controller('MenuController', function ($scope, $ionicModal, lcApi, lcApiConfig, $window, templatePath) {
    $scope.loginData = {};

    $ionicModal.fromTemplateUrl(templatePath + '/login.html', {
        scope: $scope
    }).then(function (modal) {
        $scope.modal = modal;
    });

    $scope.closeLogin = function () {
        $scope.modal.hide();
    };

    $scope.login = function () {
        $scope.modal.show();
    };

    $scope.doLogin = function () {
        lcApi.signIn($scope.loginData.username, $scope.loginData.password).then(function () {
            $scope.closeLogin();
            $window.location.reload(true)
        });
    };

    lcApiConfig.setAuthenticateFailedListener(function () {
        $scope.login();
    });

    $scope.signOut = function () {
        lcApi.signOut();
        $window.location.reload(true)
    }
});