<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-radio-group
          v-model="source"
          :label="$t('Dashboard.UI.Source')"
          mandatory
          class="mx-2"
        >
          <v-radio value="forza-horizon" :label="$t('Dashboard.UI.SourceForzaHorizon')"></v-radio>
          <v-radio value="forza-motorsport" :label="$t('Dashboard.UI.SourceForzaMotorsport')"></v-radio>
          <v-radio value="f1-25" :label="$t('Dashboard.UI.SourceF125')"></v-radio>
        </v-radio-group>
        <v-text-field
          v-model.number="udpPort"
          :label="$t('Dashboard.UI.UdpPort')"
          type="number"
          min="1"
          max="65535"
          class="mx-2 mb-4"
          hide-details
        ></v-text-field>
        <v-radio-group
          v-model="modelValue.data.displayMode"
          :label="$t('Dashboard.UI.DisplayMode')"
          mandatory
          class="mx-2"
        >
          <v-radio value="gear-rpm" :label="$t('Dashboard.UI.ModeGearRpm')"></v-radio>
          <v-radio value="gear" :label="$t('Dashboard.UI.ModeGear')"></v-radio>
          <v-radio value="rpm" :label="$t('Dashboard.UI.ModeRpm')"></v-radio>
        </v-radio-group>
        <div class="text-caption text-medium-emphasis mx-2 mb-4">
          {{ $t('Dashboard.UI.DisplayModeTip') }}
        </div>
        <v-switch
          v-model="modelValue.data.rotate180"
          :label="$t('Dashboard.UI.Rotate180')"
          color="primary"
          inset
          hide-details
          class="mx-2"
        ></v-switch>
        <div class="text-caption text-medium-emphasis mx-2 mt-2">
          {{ $t('Dashboard.UI.Rotate180Tip') }}
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: Object,
      required: true
    }
  },
  emits: ['update:modelValue'],
  computed: {
    source: {
      get() {
        return this.modelValue.data.source || 'forza-horizon'
      },
      set(value) {
        this.updateData({
          source: value,
          udpPort: value === 'f1-25' ? 20777 : 9999
        })
      }
    },
    udpPort: {
      get() {
        return this.modelValue.data.udpPort || (this.source === 'f1-25' ? 20777 : 9999)
      },
      set(value) {
        this.updateData({ udpPort: Number(value) })
      }
    }
  },
  methods: {
    updateData(patch) {
      this.$emit('update:modelValue', {
        ...this.modelValue,
        data: {
          ...(this.modelValue.data || {}),
          ...patch
        }
      })
    }
  }
}
</script>

<style scoped></style>
