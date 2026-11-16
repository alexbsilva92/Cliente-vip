package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val VipDarkColorScheme = darkColorScheme(
    primary = VipGold,
    onPrimary = Color(0xFF1A1A1A),
    primaryContainer = VipGoldContainer,
    onPrimaryContainer = VipGoldLight,
    secondary = VipAmber,
    onSecondary = Color(0xFF1A1A1A),
    background = VipNavyBg,
    onBackground = VipTextPrimary,
    surface = VipNavySurface,
    onSurface = VipTextPrimary,
    surfaceVariant = VipNavySurfaceVariant,
    onSurfaceVariant = VipTextSecondary,
    outline = VipBorder,
    error = VipCrimson,
    onError = Color.White
)

@Composable
fun ClienteVipTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = VipDarkColorScheme,
        typography = Typography,
        content = content
    )
}
