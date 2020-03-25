import React, { PureComponent } from 'react';
import {
    ColorPropType,
    Keyboard,
    Modal,
    Picker,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import PropTypes from 'prop-types';
import isEqual from 'lodash.isequal';
import { defaultStyles } from './styles';

export default class RNPickerSelect extends PureComponent {
    static propTypes = {
        onValueChange: PropTypes.func.isRequired,
        items: PropTypes.arrayOf(
            PropTypes.shape({
                label: PropTypes.string.isRequired,
                value: PropTypes.any.isRequired,
                key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
                color: ColorPropType,
                displayValue: PropTypes.bool,
            })
        ).isRequired,
        value: PropTypes.any, // eslint-disable-line react/forbid-prop-types
        placeholder: PropTypes.shape({
            label: PropTypes.string,
            value: PropTypes.any,
            key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            color: ColorPropType,
        }),
        disabled: PropTypes.bool,
        itemKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        style: PropTypes.shape({}),
        children: PropTypes.any, // eslint-disable-line react/forbid-prop-types
        placeholderTextColor: ColorPropType, // deprecated
        onOpen: PropTypes.func,
        useNativeAndroidPickerStyle: PropTypes.bool,

        // Custom Modal props (iOS only)
        hideDoneBar: PropTypes.bool, // deprecated
        doneText: PropTypes.string,
        onDonePress: PropTypes.func,
        onUpArrow: PropTypes.func,
        onDownArrow: PropTypes.func,
        onClose: PropTypes.func,

        // Modal props (iOS only)
        modalProps: PropTypes.shape({}),

        // TextInput props (iOS only)
        textInputProps: PropTypes.shape({}),

        // Picker props
        pickerProps: PropTypes.shape({}),

        // Touchable Done props (iOS only)
        touchableDoneProps: PropTypes.shape({}),

        // Touchable wrapper props
        touchableWrapperProps: PropTypes.shape({}),

        // Custom Icon
        Icon: PropTypes.func,
        InputAccessoryView: PropTypes.func,
    };

    static defaultProps = {
        value: undefined,
        placeholder: {
            label: 'Select an item...',
            value: null,
            color: '#9EA0A4',
        },
        disabled: false,
        itemKey: null,
        style: {},
        children: null,
        placeholderTextColor: '#C7C7CD', // deprecated
        useNativeAndroidPickerStyle: true,
        hideDoneBar: false, // deprecated
        doneText: 'Done',
        onDonePress: null,
        onUpArrow: null,
        onDownArrow: null,
        onOpen: null,
        onClose: null,
        modalProps: {},
        textInputProps: {},
        pickerProps: {},
        touchableDoneProps: {},
        touchableWrapperProps: {},
        Icon: null,
        InputAccessoryView: null,
    };

    static handlePlaceholder({ placeholder }) {
        if (isEqual(placeholder, {})) {
            return [];
        }
        return [placeholder];
    }

    static getSelectedItem({ items, key, value }) {
        let idx = items.findIndex((item) => {
            if (item.key && key) {
                return isEqual(item.key, key);
            }
            return isEqual(item.value || item.variation_code, value);
        });
        if (idx === -1) {
            idx = 0;
        }
        return {
            selectedItem: items[idx] || {},
            idx,
        };
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        // update items if items or placeholder prop changes
        const items = RNPickerSelect.handlePlaceholder({
            placeholder: nextProps.placeholder,
        }).concat(nextProps.items);
        const itemsChanged = !isEqual(prevState.items, items);

        // update selectedItem if value prop is defined and differs from currently selected item
        const { selectedItem, idx } = RNPickerSelect.getSelectedItem({
            items,
            key: nextProps.itemKey,
            value: nextProps.value,
        });
        const selectedItemChanged =
            !isEqual(nextProps.value, undefined) && !isEqual(prevState.selectedItem, selectedItem);

        if (itemsChanged || selectedItemChanged) {
            if (selectedItemChanged) {
                nextProps.onValueChange(selectedItem.value || selectedItem.bank_name, idx);
            }

            return {
                ...(itemsChanged ? { items } : {}),
                ...(selectedItemChanged ? { selectedItem } : {}),
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        const items = RNPickerSelect.handlePlaceholder({
            placeholder: props.placeholder,
        }).concat(props.items);

        const { selectedItem } = RNPickerSelect.getSelectedItem({
            items,
            key: props.itemKey,
            value: props.value,
        });

        this.state = {
            items,
            selectedItem,
            showPicker: false,
            animationType: undefined,
            orientation: 'portrait',
            doneDepressed: false,
        };

        this.onUpArrow = this.onUpArrow.bind(this);
        this.onDownArrow = this.onDownArrow.bind(this);
        this.onValueChange = this.onValueChange.bind(this);
        this.onOrientationChange = this.onOrientationChange.bind(this);
        this.setInputRef = this.setInputRef.bind(this);
        this.togglePicker = this.togglePicker.bind(this);
        this.renderInputAccessoryView = this.renderInputAccessoryView.bind(this);
    }

    onUpArrow() {
        const { onUpArrow } = this.props;

        this.togglePicker(false, onUpArrow);
    }

    onDownArrow() {
        const { onDownArrow } = this.props;

        this.togglePicker(false, onDownArrow);
    }

    onValueChange(value, index) {
        const { onValueChange } = this.props;

        onValueChange(value, index);

        this.setState((prevState) => {
            return {
                selectedItem: prevState.items[index],
            };
        });
    }

    onOrientationChange({ nativeEvent }) {
        this.setState({
            orientation: nativeEvent.orientation,
        });
    }

    setInputRef(ref) {
        this.inputRef = ref;
    }

    getPlaceholderStyle() {
        const { placeholder, placeholderTextColor, style } = this.props;
        const { selectedItem } = this.state;

        if (!isEqual(placeholder, {}) && selectedItem.label || selectedItem.bank_name === placeholder.label || selectedItem.bank_name) {
            return {
                ...defaultStyles.placeholder,
                color: placeholderTextColor, // deprecated
                ...style.placeholder,
            };
        }
        return {};
    }

    triggerOpenCloseCallbacks() {
        const { onOpen, onClose } = this.props;
        const { showPicker } = this.state;

        if (!showPicker && onOpen) {
            onOpen();
        }

        if (showPicker && onClose) {
            onClose();
        }
    }

    togglePicker(animate = false, postToggleCallback) {
        const { modalProps, disabled } = this.props;
        const { showPicker } = this.state;

        if (disabled) {
            return;
        }

        if (!showPicker) {
            Keyboard.dismiss();
        }

        const animationType =
            modalProps && modalProps.animationType ? modalProps.animationType : 'slide';

        this.triggerOpenCloseCallbacks();

        this.setState(
            (prevState) => {
                return {
                    animationType: animate ? animationType : undefined,
                    showPicker: !prevState.showPicker,
                };
            },
            () => {
                if (postToggleCallback) {
                    postToggleCallback();
                }
            }
        );
    }

    renderPickerItems() {
        const { items } = this.state;

        return items.map((item) => {
            return (
                <Picker.Item
                    label={item.label || item.bank_name}
                    value={item.value || item.bank_code}
                    key={item.key || item.label || item.bank_name}
                    color={item.color}
                />
            );
        });
    }

    renderInputAccessoryView() {
        const {
            InputAccessoryView,
            doneText,
            hideDoneBar,
            onUpArrow,
            onDownArrow,
            onDonePress,
            style,
            touchableDoneProps,
        } = this.props;

        const { doneDepressed } = this.state;

        // deprecated
        if (hideDoneBar) {
            return null;
        }

        if (InputAccessoryView) {
            return <InputAccessoryView testID="custom_input_accessory_view" />;
        }

        return (
            <View
                style={[defaultStyles.modalViewMiddle, style.modalViewMiddle]}
                testID="input_accessory_view"
            >
                <View style={[defaultStyles.chevronContainer, style.chevronContainer]}>
                    <TouchableOpacity
                        activeOpacity={onUpArrow ? 0.5 : 1}
                        onPress={onUpArrow ? this.onUpArrow : null}
                    >
                        <View
                            style={[
                                defaultStyles.chevron,
                                style.chevron,
                                defaultStyles.chevronUp,
                                style.chevronUp,
                                onUpArrow ? [defaultStyles.chevronActive, style.chevronActive] : {},
                            ]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={onDownArrow ? 0.5 : 1}
                        onPress={onDownArrow ? this.onDownArrow : null}
                    >
                        <View
                            style={[
                                defaultStyles.chevron,
                                style.chevron,
                                defaultStyles.chevronDown,
                                style.chevronDown,
                                onDownArrow
                                    ? [defaultStyles.chevronActive, style.chevronActive]
                                    : {},
                            ]}
                        />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        this.togglePicker(true, onDonePress);
                    }}
                    onPressIn={() => {
                        this.setState({ doneDepressed: true });
                    }}
                    onPressOut={() => {
                        this.setState({ doneDepressed: false });
                    }}
                    hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    testID="done_button"
                    {...touchableDoneProps}
                >
                    <View testID="needed_for_touchable">
                        <Text
                            testID="done_text"
                            allowFontScaling={false}
                            style={[
                                defaultStyles.done,
                                style.done,
                                doneDepressed
                                    ? [defaultStyles.doneDepressed, style.doneDepressed]
                                    : {},
                            ]}
                        >
                            {doneText}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    renderIcon() {
        const { style, Icon } = this.props;

        if (!Icon) {
            return null;
        }

        return (
            <View
                testID="icon_container"
                style={[defaultStyles.iconContainer, style.iconContainer]}
            >
                <Icon testID="icon" />
            </View>
        );
    }

    renderTextInputOrChildren() {
        const { children, style, textInputProps } = this.props;
        const { selectedItem } = this.state;

        const containerStyle =
            Platform.OS === 'ios' ? style.inputIOSContainer : style.inputAndroidContainer;

        if (children) {
            return (
                <View pointerEvents="box-only" style={containerStyle}>
                    {children}
                </View>
            );
        }

        return (
            <View pointerEvents="box-only" style={containerStyle}>
                <TextInput
                    testID="text_input"
                    style={[
                        Platform.OS === 'ios' ? style.inputIOS : style.inputAndroid,
                        this.getPlaceholderStyle(),
                    ]}
                    value={selectedItem.displayValue ? selectedItem.value : selectedItem.label || selectedItem.bank_name}
                    ref={this.setInputRef}
                    editable={false}
                    {...textInputProps}
                />
                {this.renderIcon()}
            </View>
        );
    }

    renderIOS() {
        const { style, modalProps, pickerProps, touchableWrapperProps } = this.props;
        const { animationType, orientation, selectedItem, showPicker } = this.state;

        return (
            <View style={[defaultStyles.viewContainer, style.viewContainer]}>
                <TouchableOpacity
                    testID="ios_touchable_wrapper"
                    onPress={() => {
                        this.togglePicker(true);
                    }}
                    activeOpacity={1}
                    {...touchableWrapperProps}
                >
                    {this.renderTextInputOrChildren()}
                </TouchableOpacity>
                <Modal
                    testID="ios_modal"
                    visible={showPicker}
                    transparent
                    animationType={animationType}
                    supportedOrientations={['portrait', 'landscape']}
                    onOrientationChange={this.onOrientationChange}
                    {...modalProps}
                >
                    <TouchableOpacity
                        style={[defaultStyles.modalViewTop, style.modalViewTop]}
                        testID="ios_modal_top"
                        onPress={() => {
                            this.togglePicker(true);
                        }}
                    />
                    {this.renderInputAccessoryView()}
                    <View
                        style={[
                            defaultStyles.modalViewBottom,
                            { height: orientation === 'portrait' ? 215 : 162 },
                            style.modalViewBottom,
                        ]}
                    >
                        <Picker
                            testID="ios_picker"
                            onValueChange={this.onValueChange}
                            selectedValue={selectedItem.value || selectedItem.bank_name}
                            {...pickerProps}
                        >
                            {this.renderPickerItems()}
                        </Picker>
                    </View>
                </Modal>
            </View>
        );
    }

    renderAndroidHeadless() {
        const { disabled, Icon, style, pickerProps, onOpen, touchableWrapperProps } = this.props;
        const { selectedItem } = this.state;

        return (
            <TouchableOpacity
                onPress={onOpen}
                testID="android_touchable_wrapper"
                activeOpacity={1}
                {...touchableWrapperProps}
            >
                <View style={style.headlessAndroidContainer}>
                    {this.renderTextInputOrChildren()}
                    <Picker
                        style={[
                            Icon ? { backgroundColor: 'transparent' } : {}, // to hide native icon
                            defaultStyles.headlessAndroidPicker,
                            style.headlessAndroidPicker,
                        ]}
                        testID="android_picker_headless"
                        enabled={!disabled}
                        onValueChange={this.onValueChange}
                        selectedValue={selectedItem.value}
                        {...pickerProps}
                    >
                        {this.renderPickerItems()}
                    </Picker>
                </View>
            </TouchableOpacity>
        );
    }

    renderAndroidNativePickerStyle() {
        const { disabled, Icon, style, pickerProps } = this.props;
        const { selectedItem } = this.state;

        return (
            <View style={[defaultStyles.viewContainer, style.viewContainer]}>
                <Picker
                    style={[
                        Icon ? { backgroundColor: 'transparent' } : {}, // to hide native icon
                        style.inputAndroid,
                        this.getPlaceholderStyle(),
                    ]}
                    testID="android_picker"
                    enabled={!disabled}
                    onValueChange={this.onValueChange}
                    selectedValue={selectedItem.value}
                    {...pickerProps}
                >
                    {this.renderPickerItems()}
                </Picker>
                {this.renderIcon()}
            </View>
        );
    }

    render() {
        const { children, useNativeAndroidPickerStyle } = this.props;

        if (Platform.OS === 'ios') {
            return this.renderIOS();
        }

        if (children || !useNativeAndroidPickerStyle) {
            return this.renderAndroidHeadless();
        }

        return this.renderAndroidNativePickerStyle();
    }
}

export { defaultStyles };
