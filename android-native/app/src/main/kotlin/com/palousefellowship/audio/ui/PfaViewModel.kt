package com.palousefellowship.audio.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.palousefellowship.audio.AppContainer
import com.palousefellowship.audio.PfaApplication

/** Small helper standing in for a DI framework (see AppContainer's doc
 * comment for why): builds a ViewModel with whatever [AppContainer]
 * dependencies it needs, without every screen repeating factory
 * boilerplate. */
@Composable
inline fun <reified VM : ViewModel> pfaViewModel(crossinline create: (AppContainer) -> VM): VM {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    return viewModel(
        factory = viewModelFactory {
            initializer { create(container) }
        },
    )
}
